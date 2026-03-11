import { NextResponse } from "next/server";
import { createDriveFile } from "@/lib/db/queries";
import { saveFile, getMediaType } from "@/lib/storage";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// TECH AUDIT FIX: Wrapped entire handler in try/catch
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const projectId = Number(formData.get("projectId"));
    const folderId = formData.get("folderId") ? Number(formData.get("folderId")) : null;

    if (!file || !projectId || isNaN(projectId)) {
      return NextResponse.json({ error: "file and projectId required" }, { status: 400 });
    }

    const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large (max 100MB)" }, { status: 413 });
    }

    // TECH AUDIT FIX: Validate MIME type against allowed prefixes
    const ALLOWED_MIME_PREFIXES = ["image/", "audio/", "video/", "application/pdf"];
    if (file.type && !ALLOWED_MIME_PREFIXES.some(p => file.type.startsWith(p))) {
      return NextResponse.json({ error: `File type not allowed: ${file.type}` }, { status: 400 });
    }

    // TECH AUDIT FIX: Sanitize filename to strip path components
    const safeFilename = file.name.replace(/[/\\]/g, "_");

    const buffer = Buffer.from(await file.arrayBuffer());
    const { storagePath, fileSize } = await saveFile(projectId, safeFilename, buffer);
    const fileType = getMediaType(file.type);

    const driveFile = await createDriveFile({
      projectId,
      folderId,
      filename: safeFilename,
      storagePath,
      mimeType: file.type || "application/octet-stream",
      fileSize,
      fileType,
    });

    return NextResponse.json(driveFile, { status: 201 });
  } catch (err) {
    logger.error("POST /api/drive/files/upload error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}
