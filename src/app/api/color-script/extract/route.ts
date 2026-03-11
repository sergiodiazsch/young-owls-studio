import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { sceneColorData, scenes, sceneFileLinks, driveFiles } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { extractColorsFromBuffer } from "@/lib/color-extractor";
import { logger } from "@/lib/logger";
import { readFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

interface ExtractBody {
  sceneId: number;
  imageFileId?: number;
}

/** POST /api/color-script/extract — Extract colors for a single scene */
// TECH AUDIT FIX: Added try/catch and safe JSON parsing to POST
export async function POST(req: Request) {
  try {
  await ensureSchema();

  let body: ExtractBody;
  try {
    body = (await req.json()) as ExtractBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
  }
  const { sceneId, imageFileId } = body;

  if (!sceneId) {
    return NextResponse.json(
      { error: "sceneId is required" },
      { status: 400 }
    );
  }

  // Verify scene exists
  const [scene] = await db
    .select()
    .from(scenes)
    .where(eq(scenes.id, sceneId));

  if (!scene) {
    return NextResponse.json({ error: "Scene not found" }, { status: 404 });
  }

  // Find the image to extract colors from
  let fileRecord: {
    id: number;
    storagePath: string;
    mimeType: string;
  } | undefined;

  if (imageFileId) {
    // Use the specific image file
    const [file] = await db
      .select({
        id: driveFiles.id,
        storagePath: driveFiles.storagePath,
        mimeType: driveFiles.mimeType,
      })
      .from(driveFiles)
      .where(eq(driveFiles.id, imageFileId));

    if (file) {
      fileRecord = file;
    }
  } else {
    // Find the first linked image file for this scene
    const [linkedFile] = await db
      .select({
        id: driveFiles.id,
        storagePath: driveFiles.storagePath,
        mimeType: driveFiles.mimeType,
      })
      .from(sceneFileLinks)
      .innerJoin(driveFiles, eq(sceneFileLinks.fileId, driveFiles.id))
      .where(
        and(
          eq(sceneFileLinks.sceneId, sceneId),
          eq(driveFiles.fileType, "image")
        )
      );

    if (linkedFile) {
      fileRecord = linkedFile;
    }
  }

  if (!fileRecord) {
    return NextResponse.json(
      { error: "No image found for this scene. Link an image file first." },
      { status: 404 }
    );
  }

  // Read the image buffer from storage
  let buffer: Buffer;
  try {
    buffer = await readFile(fileRecord.storagePath);
  } catch {
    return NextResponse.json(
      { error: "Could not read image file from storage" },
      { status: 500 }
    );
  }

  // Extract colors
  const colorResult = await extractColorsFromBuffer(buffer);

  const now = new Date().toISOString();
  const dominantColorsJson = JSON.stringify(colorResult.dominantColors);

  // Upsert scene_color_data
  const [existing] = await db
    .select()
    .from(sceneColorData)
    .where(eq(sceneColorData.sceneId, sceneId));

  let record;
  if (existing) {
    await db.update(sceneColorData)
      .set({
        dominantColors: dominantColorsJson,
        averageColor: colorResult.averageColor,
        brightness: colorResult.brightness,
        saturation: colorResult.saturation,
        warmth: colorResult.warmth,
        sourceImageId: fileRecord.id,
        sourceImagePath: fileRecord.storagePath,
        updatedAt: now,
      })
      .where(eq(sceneColorData.id, existing.id));

    [record] = await db
      .select()
      .from(sceneColorData)
      .where(eq(sceneColorData.id, existing.id));
  } else {
    [record] = await db
      .insert(sceneColorData)
      .values({
        sceneId,
        projectId: scene.projectId,
        dominantColors: dominantColorsJson,
        averageColor: colorResult.averageColor,
        brightness: colorResult.brightness,
        saturation: colorResult.saturation,
        warmth: colorResult.warmth,
        sourceImageId: fileRecord.id,
        sourceImagePath: fileRecord.storagePath,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
  }

  return NextResponse.json({
    ...record,
    dominantColors: colorResult.dominantColors,
  });
  } catch (error: unknown) {
    logger.error("POST /api/color-script/extract error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to extract colors";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
