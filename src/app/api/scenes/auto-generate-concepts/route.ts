import { NextResponse } from "next/server";
import { getScenesByProject, createImageGeneration } from "@/lib/db/queries";
import { safeJson } from "@/lib/api-utils";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const [body, err] = await safeJson(req);
  if (err) return err;

  const { projectId } = body;
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const pid = Number(projectId);
  if (isNaN(pid)) {
    return NextResponse.json({ error: "projectId must be a number" }, { status: 400 });
  }

  try {
    const scenes = await getScenesByProject(pid);
    if (!scenes || scenes.length === 0) {
      return NextResponse.json({ error: "No scenes found for this project" }, { status: 404 });
    }

    let queued = 0;
    const defaultModel = "nano-banana-pro";

    for (const scene of scenes) {
      // Build a prompt from the scene heading + action/description
      const heading = scene.heading || `Scene ${scene.sceneNumber}`;
      const description = scene.synopsis || scene.rawContent || "";
      const trimmedDescription = description.slice(0, 200);

      const prompt = `Cinematic still from a screenplay. ${heading}. ${trimmedDescription}`.trim();

      // Create generation record with status "queued" — don't call external AI APIs
      await createImageGeneration({
        projectId: pid,
        prompt,
        model: defaultModel,
        status: "queued",
        params: JSON.stringify({
          resolution: "1K",
          aspectRatio: "landscape",
        }),
        batchId: `auto-concept-${Date.now()}`,
        batchLabel: `Scene ${scene.sceneNumber}`,
      });

      queued++;
    }

    return NextResponse.json({ queued });
  } catch (error) {
    logger.error("POST /api/scenes/auto-generate-concepts error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Failed to queue concept generations" }, { status: 500 });
  }
}
