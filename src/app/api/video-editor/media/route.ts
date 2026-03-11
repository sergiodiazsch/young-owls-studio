import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq, and, asc, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = Number(searchParams.get("projectId"));
    if (!projectId || isNaN(projectId)) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    // Drive files
    const driveFiles = await db.select().from(schema.driveFiles)
      .where(eq(schema.driveFiles.projectId, projectId))
      .orderBy(desc(schema.driveFiles.createdAt));

    // Voice generations — selected only, with dialogue + scene info
    const voiceRows = await db
      .select({
        id: schema.voiceGenerations.id,
        storagePath: schema.voiceGenerations.storagePath,
        paddedStoragePath: schema.voiceGenerations.paddedStoragePath,
        durationMs: schema.voiceGenerations.durationMs,
        inputText: schema.voiceGenerations.inputText,
        mimeType: schema.voiceGenerations.mimeType,
        character: schema.dialogues.character,
        sceneHeading: schema.scenes.heading,
        sceneId: schema.voiceGenerations.sceneId,
      })
      .from(schema.voiceGenerations)
      .innerJoin(schema.dialogues, eq(schema.voiceGenerations.dialogueId, schema.dialogues.id))
      .innerJoin(schema.scenes, eq(schema.voiceGenerations.sceneId, schema.scenes.id))
      .where(
        and(
          eq(schema.voiceGenerations.projectId, projectId),
          eq(schema.voiceGenerations.selected, true),
        )
      )
      .orderBy(asc(schema.scenes.sortOrder), asc(schema.dialogues.sortOrder));

    // Image generations — completed with storagePath
    const imageRows = await db.select({
      id: schema.imageGenerations.id,
      storagePath: schema.imageGenerations.storagePath,
      prompt: schema.imageGenerations.prompt,
      createdAt: schema.imageGenerations.createdAt,
    }).from(schema.imageGenerations)
      .where(
        and(
          eq(schema.imageGenerations.projectId, projectId),
          eq(schema.imageGenerations.status, "completed"),
        )
      )
      .orderBy(desc(schema.imageGenerations.createdAt));

    const imageGenerations = imageRows.filter(r => r.storagePath);

    // Video generations — completed with storagePath
    const videoRows = await db.select({
      id: schema.videoGenerations.id,
      storagePath: schema.videoGenerations.storagePath,
      prompt: schema.videoGenerations.prompt,
      durationMs: schema.videoGenerations.durationMs,
      createdAt: schema.videoGenerations.createdAt,
    }).from(schema.videoGenerations)
      .where(
        and(
          eq(schema.videoGenerations.projectId, projectId),
          eq(schema.videoGenerations.status, "completed"),
        )
      )
      .orderBy(desc(schema.videoGenerations.createdAt));

    const videoGenerations = videoRows.filter(r => r.storagePath);

    // Audio studio generations — completed with storagePath
    const audioRows = await db.select({
      id: schema.audioStudioGenerations.id,
      storagePath: schema.audioStudioGenerations.storagePath,
      prompt: schema.audioStudioGenerations.prompt,
      type: schema.audioStudioGenerations.type,
      durationSeconds: schema.audioStudioGenerations.durationSeconds,
      createdAt: schema.audioStudioGenerations.createdAt,
    }).from(schema.audioStudioGenerations)
      .where(
        and(
          eq(schema.audioStudioGenerations.projectId, projectId),
          eq(schema.audioStudioGenerations.status, "completed"),
        )
      )
      .orderBy(desc(schema.audioStudioGenerations.createdAt));

    const audioStudioGenerations = audioRows.filter(r => r.storagePath);

    return NextResponse.json({
      driveFiles,
      voiceGenerations: voiceRows,
      imageGenerations,
      videoGenerations,
      audioStudioGenerations,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load media";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
