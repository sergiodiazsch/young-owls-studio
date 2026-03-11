import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq, and, asc, desc, inArray } from "drizzle-orm";
import {
  createVideoEditorTrack,
  createVideoEditorClip,
  getVideoEditorTracks,
  updateVideoEditorProject,
} from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { editorProjectId, projectId, sceneIds } = body;

    if (!editorProjectId || !projectId) {
      return NextResponse.json(
        { error: "editorProjectId and projectId are required" },
        { status: 400 }
      );
    }

    // 1. Fetch scenes (all or selected)
    let scenes;
    if (sceneIds && sceneIds.length > 0) {
      scenes = await db
        .select()
        .from(schema.scenes)
        .where(
          and(
            eq(schema.scenes.projectId, Number(projectId)),
            inArray(schema.scenes.id, sceneIds.map(Number))
          )
        )
        .orderBy(asc(schema.scenes.sortOrder));
    } else {
      scenes = await db
        .select()
        .from(schema.scenes)
        .where(eq(schema.scenes.projectId, Number(projectId)))
        .orderBy(asc(schema.scenes.sortOrder));
    }

    if (scenes.length === 0) {
      return NextResponse.json({ error: "No scenes found" }, { status: 400 });
    }

    // 2. For each scene, collect visual assets and voice generations
    const sceneData = await Promise.all(
      scenes.map(async (scene) => {
        // Get dialogues ordered by sortOrder
        const dialogues = await db
          .select()
          .from(schema.dialogues)
          .where(eq(schema.dialogues.sceneId, scene.id))
          .orderBy(asc(schema.dialogues.sortOrder));

        // Get selected voice generations for this scene
        const voices = await db
          .select()
          .from(schema.voiceGenerations)
          .where(
            and(
              eq(schema.voiceGenerations.sceneId, scene.id),
              eq(schema.voiceGenerations.selected, true)
            )
          )
          .orderBy(
            asc(schema.voiceGenerations.dialogueId),
            asc(schema.voiceGenerations.optionIndex)
          );

        // Get linked files for visual asset (video first, then image)
        const linkedFiles = await db
          .select({ file: schema.driveFiles })
          .from(schema.sceneFileLinks)
          .innerJoin(
            schema.driveFiles,
            eq(schema.sceneFileLinks.fileId, schema.driveFiles.id)
          )
          .where(eq(schema.sceneFileLinks.sceneId, scene.id));

        // Priority: video file > image file > image generation
        const videoFile = linkedFiles.find(
          (lf) => lf.file.fileType === "video"
        );
        const imageFile = linkedFiles.find(
          (lf) => lf.file.fileType === "image"
        );

        let visualAsset: {
          type: "video" | "image";
          storagePath: string;
          sourceType: string;
          sourceId: number;
        } | null = null;

        if (videoFile) {
          visualAsset = {
            type: "video",
            storagePath: videoFile.file.storagePath,
            sourceType: "drive",
            sourceId: videoFile.file.id,
          };
        } else if (imageFile) {
          visualAsset = {
            type: "image",
            storagePath: imageFile.file.storagePath,
            sourceType: "drive",
            sourceId: imageFile.file.id,
          };
        } else {
          // Fallback: most recent completed image generation for this project
          const imgGens = await db
            .select()
            .from(schema.imageGenerations)
            .where(
              and(
                eq(schema.imageGenerations.projectId, Number(projectId)),
                eq(schema.imageGenerations.status, "completed")
              )
            )
            .orderBy(desc(schema.imageGenerations.createdAt))
            .limit(1);

          if (imgGens.length > 0 && imgGens[0].storagePath) {
            visualAsset = {
              type: "image",
              storagePath: imgGens[0].storagePath,
              sourceType: "image_generation",
              sourceId: imgGens[0].id,
            };
          }
        }

        // Build voice clips data with dialogue info
        const voiceClips = voices
          .filter((v) => v.storagePath)
          .map((v) => {
            const dialogue = dialogues.find((d) => d.id === v.dialogueId);
            return {
              voiceId: v.id,
              storagePath: v.paddedStoragePath || v.storagePath,
              durationMs: v.durationMs || 3000,
              character: dialogue?.character || "Unknown",
              line: dialogue?.line || v.inputText,
              dialogueId: v.dialogueId,
            };
          });

        return {
          scene,
          visualAsset,
          voiceClips,
        };
      })
    );

    // 3. Ensure tracks exist: V1, A1, T1
    const existingTracks = await getVideoEditorTracks(Number(editorProjectId));

    let v1Track = existingTracks.find(
      (t) => t.type === "video" && t.sortOrder === 0
    );
    let a1Track = existingTracks.find(
      (t) => t.type === "audio" && t.sortOrder === 1
    );
    let t1Track = existingTracks.find(
      (t) => t.type === "text" && t.sortOrder === 2
    );

    if (!v1Track) {
      v1Track = await createVideoEditorTrack({
        editorProjectId: Number(editorProjectId),
        type: "video",
        name: "V1 - Video",
        sortOrder: 0,
      });
    }
    if (!a1Track) {
      a1Track = await createVideoEditorTrack({
        editorProjectId: Number(editorProjectId),
        type: "audio",
        name: "A1 - Dialogue",
        sortOrder: 1,
      });
    }
    if (!t1Track) {
      t1Track = await createVideoEditorTrack({
        editorProjectId: Number(editorProjectId),
        type: "text",
        name: "T1 - Titles",
        sortOrder: 2,
      });
    }

    // 4. Delete existing clips on these tracks (clean build)
    const trackIds = [v1Track.id, a1Track.id, t1Track.id];
    for (const tid of trackIds) {
      await db
        .delete(schema.videoEditorClips)
        .where(eq(schema.videoEditorClips.trackId, tid));
    }

    // 5. Build timeline
    let currentMs = 0;
    let clipsCreated = 0;
    let scenesWithAssets = 0;
    let scenesWithoutAssets = 0;
    const SCENE_GAP_MS = 500;

    for (const { scene, visualAsset, voiceClips } of sceneData) {
      // Calculate scene duration from voice clips, or default 4s
      const sceneDurationMs =
        voiceClips.length > 0
          ? voiceClips.reduce((sum, v) => sum + v.durationMs, 0)
          : 4000;

      // Visual clip on V1
      if (visualAsset) {
        await createVideoEditorClip({
          trackId: v1Track.id,
          editorProjectId: Number(editorProjectId),
          type: visualAsset.type,
          name: scene.heading,
          startMs: currentMs,
          durationMs: sceneDurationMs,
          sourcePath: visualAsset.storagePath,
          sourceType: visualAsset.sourceType,
          sourceId: visualAsset.sourceId,
        });
        clipsCreated++;
        scenesWithAssets++;
      } else {
        scenesWithoutAssets++;
      }

      // Voice clips on A1 (sequential within scene)
      let voiceStartMs = currentMs;
      for (const vc of voiceClips) {
        await createVideoEditorClip({
          trackId: a1Track.id,
          editorProjectId: Number(editorProjectId),
          type: "audio",
          name: `${vc.character}: ${vc.line.slice(0, 40)}`,
          startMs: voiceStartMs,
          durationMs: vc.durationMs,
          sourcePath: vc.storagePath,
          sourceType: "voice_generation",
          sourceId: vc.voiceId,
        });
        voiceStartMs += vc.durationMs;
        clipsCreated++;
      }

      // Title clip on T1
      await createVideoEditorClip({
        trackId: t1Track.id,
        editorProjectId: Number(editorProjectId),
        type: "text",
        name: `Title: ${scene.heading}`,
        startMs: currentMs,
        durationMs: Math.min(3000, sceneDurationMs),
        textContent: scene.heading,
        textStyle: JSON.stringify({
          fontSize: 24,
          color: "#ffffff",
          background: "rgba(0,0,0,0.7)",
          position: "bottom-left",
        }),
      });
      clipsCreated++;

      currentMs += sceneDurationMs + SCENE_GAP_MS;
    }

    // 6. Update project duration
    const totalDurationMs = Math.max(0, currentMs - SCENE_GAP_MS);
    await updateVideoEditorProject(Number(editorProjectId), {
      durationMs: totalDurationMs,
    });

    return NextResponse.json({
      success: true,
      tracksCreated: trackIds.length,
      clipsCreated,
      scenesProcessed: scenes.length,
      scenesWithAssets,
      scenesWithoutAssets,
      totalDurationMs,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Auto-build failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
