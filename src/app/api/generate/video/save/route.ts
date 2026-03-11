import { NextResponse } from "next/server";
import { getVideoGeneration, updateVideoGeneration, createDriveFile, createSceneFileLink } from "@/lib/db/queries";
import { readFile, saveFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // TECH AUDIT FIX: Wrapped req.json() in try/catch for malformed JSON
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
  }
  const generationId = Number(body.generationId);
  const folderId = body.folderId != null ? Number(body.folderId) : null;
  const sceneId = body.sceneId != null ? Number(body.sceneId) : null;
  if (!generationId || isNaN(generationId)) return NextResponse.json({ error: "generationId required" }, { status: 400 });

  const gen = await getVideoGeneration(generationId);
  if (!gen || !gen.storagePath) {
    return NextResponse.json({ error: "Generation not found or not completed" }, { status: 404 });
  }

  try {
    const buffer = await readFile(gen.storagePath);
    const filename = `video-${gen.id}-${Date.now()}.mp4`;
    const { storagePath, fileSize } = await saveFile(gen.projectId, filename, buffer);

    const driveFile = await createDriveFile({
      projectId: gen.projectId,
      folderId: folderId || null,
      filename,
      storagePath,
      mimeType: gen.mimeType || "video/mp4",
      fileSize,
      fileType: "video",
      generatedBy: "fal.ai",
      generationPrompt: gen.prompt,
      seed: gen.seed ?? null,
    });

    if (sceneId) {
      await createSceneFileLink(sceneId, driveFile.id);
    }

    await updateVideoGeneration(gen.id, { driveFileId: driveFile.id });

    return NextResponse.json(driveFile);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Save failed" },
      { status: 500 }
    );
  }
}
