import { NextResponse } from "next/server";
import { getDriveFiles, createDriveFile } from "@/lib/db/queries";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// TECH AUDIT FIX: Added try/catch and projectId validation
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = Number(searchParams.get("projectId"));
    if (!projectId || isNaN(projectId)) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }
    const folderId = searchParams.get("folderId") ? Number(searchParams.get("folderId")) : null;
    const search = searchParams.get("search") || undefined;
    const limit = Math.min(Number(searchParams.get("limit")) || 100, 500);
    const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);
    const files = await getDriveFiles(projectId, folderId, search, limit, offset);
    return NextResponse.json(files);
  } catch (err) {
    logger.error("GET /api/drive/files error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to fetch drive files" }, { status: 500 });
  }
}

// POST: save a generated file to the drive
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { projectId, folderId, filename, storagePath, mimeType, fileSize, fileType, caption, generatedBy, generationPrompt } = body;

    if (!projectId || !filename || !storagePath) {
      return NextResponse.json({ error: "projectId, filename, and storagePath are required" }, { status: 400 });
    }

    const file = await createDriveFile({
      projectId: Number(projectId),
      folderId: folderId ? Number(folderId) : null,
      filename,
      storagePath,
      mimeType: mimeType || "application/octet-stream",
      fileSize: fileSize || 0,
      fileType: fileType || "other",
      caption: caption || undefined,
      generatedBy: generatedBy || undefined,
      generationPrompt: generationPrompt || undefined,
    });

    return NextResponse.json(file);
  } catch (err) {
    logger.error("POST /api/drive/files error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to save file to drive" }, { status: 500 });
  }
}
