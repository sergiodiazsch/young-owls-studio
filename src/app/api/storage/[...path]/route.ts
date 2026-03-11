import { NextResponse } from "next/server";
import { readFile } from "@/lib/storage";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const MIME_MAP: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".flac": "audio/flac",
  ".aac": "audio/aac",
  ".m4a": "audio/mp4",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
};

function getMimeType(storagePath: string): string {
  const ext = storagePath.slice(storagePath.lastIndexOf(".")).toLowerCase();
  return MIME_MAP[ext] || "application/octet-stream";
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: segments } = await params;
    const storagePath = segments.join("/");

    if (!storagePath || storagePath.includes("..")) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const buffer = await readFile(storagePath);
    const mimeType = getMimeType(storagePath);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(buffer.length),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "File not found";
    if (message.includes("not found")) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    logger.error("GET /api/storage/[...path] error", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
