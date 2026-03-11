import { NextResponse } from "next/server";
import { submitVideoUpscale } from "@/lib/fal";
import { createVideoGeneration, updateVideoGeneration } from "@/lib/db/queries";
import { safeJson } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

// TECH AUDIT FIX: Added proper types for request body
interface UpscaleBody {
  projectId: number;
  sourceVideoPath: string;
  model: string;
  scale?: number;
  targetFps?: number;
}

export async function POST(req: Request) {
  const [body, err] = await safeJson<UpscaleBody>(req);
  if (err) return err;
  const { projectId, sourceVideoPath, model, scale, targetFps } = body;

  if (!projectId || !sourceVideoPath || !model) {
    return NextResponse.json(
      { error: "projectId, sourceVideoPath, and model required" },
      { status: 400 }
    );
  }

  const mode = (targetFps && (!scale || scale <= 1)) ? "fps-boost" : "upscale";

  const row = await createVideoGeneration({
    projectId,
    prompt: `${mode === "upscale" ? `${scale}x upscale` : `FPS boost to ${targetFps}`}`,
    model,
    mode,
    status: "submitted",
    params: JSON.stringify({ scale, targetFps, upscaleModel: model }),
    sourceVideoPath,
  });

  try {
    const result = await submitVideoUpscale({
      sourceVideoPath,
      model,
      scale,
      targetFps,
    });

    await updateVideoGeneration(row.id, {
      falRequestId: result.request_id,
      status: "submitted",
      params: JSON.stringify({ _falResponseUrl: result.response_url, _falStatusUrl: result.status_url }),
    });

    return NextResponse.json({
      ...row,
      falRequestId: result.request_id,
      status: "submitted",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Upscale submission failed";
    await updateVideoGeneration(row.id, { status: "failed", error: message });
    return NextResponse.json({ ...row, status: "failed", error: message }, { status: 500 });
  }
}
