import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import {
  scenes,
  sceneFileLinks,
  driveFiles,
  sceneColorData,
} from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { extractColorsFromBuffer } from "@/lib/color-extractor";
import { logger } from "@/lib/logger";
import { readFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

interface ExtractAllBody {
  projectId: number;
}

interface ExtractionResult {
  sceneId: number;
  sceneNumber: number;
  status: "extracted" | "skipped" | "error";
  error?: string;
}

/** POST /api/color-script/extract-all — Extract colors for all scenes in a project */
// TECH AUDIT FIX: Added try/catch and safe JSON parsing to POST
export async function POST(req: Request) {
  try {
  await ensureSchema();

  let body: ExtractAllBody;
  try {
    body = (await req.json()) as ExtractAllBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
  }
  const { projectId } = body;

  if (!projectId) {
    return NextResponse.json(
      { error: "projectId is required" },
      { status: 400 }
    );
  }

  // Get all scenes for the project
  const projectScenes = await db
    .select()
    .from(scenes)
    .where(eq(scenes.projectId, projectId))
    .orderBy(asc(scenes.sortOrder));

  const results: ExtractionResult[] = [];
  let extracted = 0;
  let skipped = 0;
  let errors = 0;

  for (const scene of projectScenes) {
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
          eq(sceneFileLinks.sceneId, scene.id),
          eq(driveFiles.fileType, "image")
        )
      );

    if (!linkedFile) {
      results.push({
        sceneId: scene.id,
        sceneNumber: scene.sceneNumber,
        status: "skipped",
        error: "No linked image",
      });
      skipped++;
      continue;
    }

    try {
      const buffer = await readFile(linkedFile.storagePath);
      const colorResult = await extractColorsFromBuffer(buffer);

      const now = new Date().toISOString();
      const dominantColorsJson = JSON.stringify(colorResult.dominantColors);

      // Upsert
      const [existing] = await db
        .select()
        .from(sceneColorData)
        .where(eq(sceneColorData.sceneId, scene.id));

      if (existing) {
        await db.update(sceneColorData)
          .set({
            dominantColors: dominantColorsJson,
            averageColor: colorResult.averageColor,
            brightness: colorResult.brightness,
            saturation: colorResult.saturation,
            warmth: colorResult.warmth,
            sourceImageId: linkedFile.id,
            sourceImagePath: linkedFile.storagePath,
            updatedAt: now,
          })
          .where(eq(sceneColorData.id, existing.id));
      } else {
        await db.insert(sceneColorData)
          .values({
            sceneId: scene.id,
            projectId,
            dominantColors: dominantColorsJson,
            averageColor: colorResult.averageColor,
            brightness: colorResult.brightness,
            saturation: colorResult.saturation,
            warmth: colorResult.warmth,
            sourceImageId: linkedFile.id,
            sourceImagePath: linkedFile.storagePath,
            createdAt: now,
            updatedAt: now,
          });
      }

      results.push({
        sceneId: scene.id,
        sceneNumber: scene.sceneNumber,
        status: "extracted",
      });
      extracted++;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      results.push({
        sceneId: scene.id,
        sceneNumber: scene.sceneNumber,
        status: "error",
        error: message,
      });
      errors++;
    }
  }

  return NextResponse.json({
    total: projectScenes.length,
    extracted,
    skipped,
    errors,
    results,
  });
  } catch (error: unknown) {
    logger.error("POST /api/color-script/extract-all error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to extract colors for all scenes";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
