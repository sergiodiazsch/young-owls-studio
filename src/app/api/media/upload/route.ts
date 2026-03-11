import { NextResponse } from "next/server";
import { saveFile, getMediaType } from "@/lib/storage";
import { createMedia } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

// TECH AUDIT FIX: Wrapped entire handler in try/catch, added NaN validation and MIME check
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const projectId = formData.get("projectId") as string | null;
    const sceneId = formData.get("sceneId") as string | null;
    const caption = formData.get("caption") as string | null;

    if (!file || !projectId) {
      return NextResponse.json({ error: "file and projectId are required" }, { status: 400 });
    }

    // TECH AUDIT FIX: Validate projectId is a valid number
    const pid = Number(projectId);
    if (isNaN(pid) || pid <= 0) {
      return NextResponse.json({ error: "projectId must be a positive number" }, { status: 400 });
    }

    const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large (max 100MB)" }, { status: 413 });
    }

    // TECH AUDIT FIX: Validate MIME type
    const ALLOWED_MIME_PREFIXES = ["image/", "audio/", "video/", "application/pdf"];
    if (file.type && !ALLOWED_MIME_PREFIXES.some(p => file.type.startsWith(p))) {
      return NextResponse.json({ error: `File type not allowed: ${file.type}` }, { status: 400 });
    }

    // TECH AUDIT FIX: Sanitize filename
    const safeFilename = file.name.replace(/[/\\]/g, "_");

    const buffer = Buffer.from(await file.arrayBuffer());
    const { storagePath, fileSize } = await saveFile(pid, safeFilename, buffer);
    const mediaType = getMediaType(file.type);

    const record = await createMedia({
      projectId: pid,
      sceneId: sceneId ? Number(sceneId) : undefined,
      filename: safeFilename,
      storagePath,
      mimeType: file.type || "application/octet-stream",
      fileSize,
      mediaType,
      caption: caption || undefined,
    });

    return NextResponse.json(record, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
