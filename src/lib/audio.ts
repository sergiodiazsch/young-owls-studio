import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const STORAGE_ROOT = path.join(process.cwd(), "storage");

export async function padAudio(
  inputStoragePath: string,
  paddingStart: number,
  paddingEnd: number
): Promise<{ storagePath: string; fileSize: number }> {
  const inputPath = path.join(STORAGE_ROOT, inputStoragePath);
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputStoragePath}`);
  }

  // Nothing to pad — return the original
  if (paddingStart <= 0 && paddingEnd <= 0) {
    const stats = fs.statSync(inputPath);
    return { storagePath: inputStoragePath, fileSize: stats.size };
  }

  const dir = path.dirname(inputPath);
  const outputName = `padded-${uuidv4()}.mp3`;
  const outputPath = path.join(dir, outputName);

  const filters: string[] = [];

  if (paddingStart > 0) {
    filters.push(`adelay=${Math.round(paddingStart * 1000)}|${Math.round(paddingStart * 1000)}`);
  }

  if (paddingEnd > 0) {
    filters.push(`apad=pad_dur=${paddingEnd}`);
  }

  return new Promise((resolve, reject) => {
    let cmd = ffmpeg(inputPath);

    if (filters.length > 0) {
      cmd = cmd.audioFilters(filters);
    }

    cmd
      .audioCodec("libmp3lame")
      .audioBitrate(128)
      .output(outputPath)
      .on("end", () => {
        const stats = fs.statSync(outputPath);
        const relativePath = path.relative(STORAGE_ROOT, outputPath);
        resolve({ storagePath: relativePath, fileSize: stats.size });
      })
      .on("error", (err) => {
        // Clean up partial output file
        if (fs.existsSync(outputPath)) {
          try { fs.unlinkSync(outputPath); } catch {}
        }
        reject(new Error(`FFmpeg error: ${err.message}`));
      })
      .run();
  });
}
