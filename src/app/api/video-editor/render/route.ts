import { NextResponse } from "next/server";
import { getFullVideoEditorProject, updateVideoEditorProject } from "@/lib/db/queries";
import { getAbsolutePath } from "@/lib/storage";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import path from "path";
import fs from "fs";
import { v4 as uuid } from "uuid";
import { logger } from "@/lib/logger";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min for rendering

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { editorProjectId } = body;
    if (!editorProjectId) {
      return NextResponse.json({ error: "editorProjectId is required" }, { status: 400 });
    }

    const project = await getFullVideoEditorProject(Number(editorProjectId));
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Mark as rendering
    await updateVideoEditorProject(project.id, { status: "rendering", renderProgress: 0, renderError: null });

    // Collect all clips across tracks sorted by start time
    const videoClips = project.tracks
      .filter(t => t.type === "video")
      .flatMap(t => t.clips)
      .filter(c => c.sourcePath)
      .sort((a, b) => a.startMs - b.startMs);

    const audioClips = project.tracks
      .filter(t => t.type === "audio")
      .flatMap(t => t.clips)
      .filter(c => c.sourcePath)
      .sort((a, b) => a.startMs - b.startMs);

    if (videoClips.length === 0 && audioClips.length === 0) {
      await updateVideoEditorProject(project.id, { status: "failed", renderError: "No clips to render" });
      return NextResponse.json({ error: "No clips to render" }, { status: 400 });
    }

    const storageDir = path.join(process.cwd(), "storage", String(project.projectId));
    fs.mkdirSync(storageDir, { recursive: true });
    const outputFilename = `render-${uuid()}.mp4`;
    const outputAbsPath = path.join(storageDir, outputFilename);
    const outputStoragePath = `${project.projectId}/${outputFilename}`;

    // Simple case: single video clip, optionally with audio overlay
    if (videoClips.length === 1 && audioClips.length <= 1) {
      const videoPath = getAbsolutePath(videoClips[0].sourcePath!);
      const audioPath = audioClips.length === 1 && audioClips[0].sourcePath
        ? getAbsolutePath(audioClips[0].sourcePath)
        : null;

      await renderSingleVideo(videoPath, audioPath, videoClips[0], audioClips[0], outputAbsPath, project);
    } else {
      // Complex case: multiple clips — use concat + audio mix
      await renderMultiClip(videoClips, audioClips, outputAbsPath, project);
    }

    const stats = fs.statSync(outputAbsPath);
    await updateVideoEditorProject(project.id, {
      status: "completed",
      renderProgress: 100,
      outputPath: outputStoragePath,
      outputSize: stats.size,
    });

    return NextResponse.json({
      success: true,
      outputPath: outputStoragePath,
      outputSize: stats.size,
    });
  } catch (error: unknown) {
    logger.error("Render error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Render failed";
    // Try to update status
    try {
      const body = await req.clone().json();
      if (body.editorProjectId) {
        await updateVideoEditorProject(Number(body.editorProjectId), { status: "failed", renderError: message });
      }
    } catch {}
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

interface ClipData {
  startMs: number;
  durationMs: number;
  sourceStartMs: number;
  sourceEndMs: number | null;
  volume: number;
  playbackRate: number;
}

interface ProjectData {
  width: number;
  height: number;
  fps: number;
}

function renderSingleVideo(
  videoPath: string,
  audioPath: string | null,
  videoClip: ClipData,
  audioClip: ClipData | undefined,
  outputPath: string,
  project: ProjectData,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let cmd = ffmpeg();

    // Input video
    cmd = cmd.input(videoPath);
    if (videoClip.sourceStartMs > 0) {
      cmd = cmd.inputOptions([`-ss ${videoClip.sourceStartMs / 1000}`]);
    }
    if (videoClip.sourceEndMs) {
      const duration = (videoClip.sourceEndMs - videoClip.sourceStartMs) / 1000;
      cmd = cmd.inputOptions([`-t ${duration}`]);
    }

    // Input audio if present
    if (audioPath) {
      cmd = cmd.input(audioPath);
      if (audioClip?.sourceStartMs && audioClip.sourceStartMs > 0) {
        cmd = cmd.inputOptions([`-ss ${audioClip.sourceStartMs / 1000}`]);
      }
    }

    const filters: string[] = [];
    filters.push(`[0:v]scale=${project.width}:${project.height}:force_original_aspect_ratio=decrease,pad=${project.width}:${project.height}:(ow-iw)/2:(oh-ih)/2[vout]`);

    if (audioPath) {
      const videoVol = videoClip.volume !== undefined ? videoClip.volume : 1;
      const audioVol = audioClip?.volume !== undefined ? audioClip.volume : 1;
      filters.push(`[0:a]volume=${videoVol}[a0]`);
      filters.push(`[1:a]volume=${audioVol}[a1]`);
      filters.push(`[a0][a1]amix=inputs=2:duration=first[aout]`);
      cmd = cmd.complexFilter(filters).outputOptions(["-map [vout]", "-map [aout]"]);
    } else {
      cmd = cmd.complexFilter(filters).outputOptions(["-map [vout]", "-map 0:a?"]);
    }

    cmd
      .outputOptions([
        `-r ${project.fps}`,
        "-c:v libx264",
        "-preset fast",
        "-crf 23",
        "-c:a aac",
        "-b:a 192k",
        "-movflags +faststart",
      ])
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (err) => reject(new Error(`FFmpeg error: ${err.message}`)))
      .run();
  });
}

function renderMultiClip(
  videoClips: Array<ClipData & { sourcePath: string | null }>,
  audioClips: Array<ClipData & { sourcePath: string | null }>,
  outputPath: string,
  project: ProjectData,
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Create a concat list file for video clips
    const tmpDir = path.join(process.cwd(), "storage", "tmp");
    fs.mkdirSync(tmpDir, { recursive: true });
    const concatFile = path.join(tmpDir, `concat-${Date.now()}.txt`);

    const lines = videoClips
      .filter(c => c.sourcePath)
      .map(c => `file '${getAbsolutePath(c.sourcePath!)}'`);
    fs.writeFileSync(concatFile, lines.join("\n"));

    let cmd = ffmpeg()
      .input(concatFile)
      .inputOptions(["-f concat", "-safe 0"]);

    // Add audio tracks as additional inputs
    for (const ac of audioClips) {
      if (ac.sourcePath) {
        cmd = cmd.input(getAbsolutePath(ac.sourcePath));
      }
    }

    const filters: string[] = [];
    filters.push(`[0:v]scale=${project.width}:${project.height}:force_original_aspect_ratio=decrease,pad=${project.width}:${project.height}:(ow-iw)/2:(oh-ih)/2[vout]`);

    if (audioClips.length > 0) {
      // Mix all audio: video audio + additional audio tracks
      const audioInputs: string[] = [];
      audioInputs.push("[0:a]");
      audioClips.forEach((_, i) => audioInputs.push(`[${i + 1}:a]`));
      const allAudio = audioInputs.join("");
      filters.push(`${allAudio}amix=inputs=${audioInputs.length}:duration=first[aout]`);
      cmd = cmd.complexFilter(filters).outputOptions(["-map [vout]", "-map [aout]"]);
    } else {
      cmd = cmd.complexFilter(filters).outputOptions(["-map [vout]", "-map 0:a?"]);
    }

    cmd
      .outputOptions([
        `-r ${project.fps}`,
        "-c:v libx264",
        "-preset fast",
        "-crf 23",
        "-c:a aac",
        "-b:a 192k",
        "-movflags +faststart",
      ])
      .output(outputPath)
      .on("end", () => {
        // Clean up temp file
        try { fs.unlinkSync(concatFile); } catch {}
        resolve();
      })
      .on("error", (err) => {
        try { fs.unlinkSync(concatFile); } catch {}
        reject(new Error(`FFmpeg error: ${err.message}`));
      })
      .run();
  });
}
