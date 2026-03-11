import { NextResponse } from "next/server";
import { saveFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const projectId = formData.get("projectId") as string | null;

    if (!file || !projectId) {
      return NextResponse.json({ error: "file and projectId required" }, { status: 400 });
    }

    // TECH AUDIT FIX: Validate projectId
    const pid = Number(projectId);
    if (isNaN(pid) || pid <= 0) {
      return NextResponse.json({ error: "projectId must be a positive number" }, { status: 400 });
    }

    // TECH AUDIT FIX: Validate file size (20MB max for reference images)
    const MAX_REF_SIZE = 20 * 1024 * 1024;
    if (file.size > MAX_REF_SIZE) {
      return NextResponse.json({ error: "File too large (max 20MB)" }, { status: 413 });
    }

    // TECH AUDIT FIX: Only allow image types for reference upload
    if (file.type && !file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image files allowed for reference upload" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const safeFilename = file.name.replace(/[/\\]/g, "_");
    const { storagePath, fileSize } = await saveFile(pid, safeFilename, buffer);

    return NextResponse.json({
      storagePath,
      fileSize,
      mimeType: file.type || "image/png",
      filename: file.name,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
