import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import path from "path";
import fs from "fs";
import os from "os";
import { v4 as uuidv4 } from "uuid";
import { readFile, saveFile } from "./storage";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export async function padAudio(
  inputStoragePath: string,
  paddingStart: number,
  paddingEnd: number
): Promise<{ storagePath: string; fileSize: number }> {
  // Nothing to pad — read file size from storage and return original
  if (paddingStart <= 0 && paddingEnd <= 0) {
    const buf = await readFile(inputStoragePath);
    return { storagePath: inputStoragePath, fileSize: buf.length };
  }

  // Download source file to tmp for ffmpeg processing
  const tmpDir = path.join(os.tmpdir(), `pad-${uuidv4()}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  const inputPath = path.join(tmpDir, "input.mp3");
  const outputPath = path.join(tmpDir, "output.mp3");

  try {
    const inputBuffer = await readFile(inputStoragePath);
    fs.writeFileSync(inputPath, inputBuffer);

    const filters: string[] = [];

    if (paddingStart > 0) {
      filters.push(`adelay=${Math.round(paddingStart * 1000)}|${Math.round(paddingStart * 1000)}`);
    }

    if (paddingEnd > 0) {
      filters.push(`apad=pad_dur=${paddingEnd}`);
    }

    await new Promise<void>((resolve, reject) => {
      let cmd = ffmpeg(inputPath);

      if (filters.length > 0) {
        cmd = cmd.audioFilters(filters);
      }

      cmd
        .audioCodec("libmp3lame")
        .audioBitrate(128)
        .output(outputPath)
        .on("end", () => resolve())
        .on("error", (err) => reject(new Error(`FFmpeg error: ${err.message}`)))
        .run();
    });

    // Read output and save back to storage
    const outputBuffer = fs.readFileSync(outputPath);
    const projectId = Number(inputStoragePath.split("/")[0]) || 0;
    const result = await saveFile(projectId, `padded-${uuidv4()}.mp3`, outputBuffer);
    return result;
  } finally {
    // Clean up tmp files
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}
