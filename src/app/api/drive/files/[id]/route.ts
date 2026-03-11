import { NextResponse } from "next/server";
import { getDriveFile, updateDriveFile, deleteDriveFile } from "@/lib/db/queries";
import { readFile, deleteFile } from "@/lib/storage";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// TECH AUDIT FIX: Added try/catch and NaN validation to GET handler
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
  const { id } = await params;
  const numId = Number(id);
  if (isNaN(numId)) return NextResponse.json({ error: "Invalid file ID" }, { status: 400 });
  const { searchParams } = new URL(req.url);
  const file = await getDriveFile(numId);
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Return JSON metadata instead of binary
  if (searchParams.get("info") === "true") {
    return NextResponse.json(file);
  }

  try {
    const buffer = await readFile(file.storagePath);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": String(buffer.length),
        "Content-Disposition": `attachment; filename="${file.filename.replace(/["\r\n]/g, "_")}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found on disk" }, { status: 404 });
  }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch file";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// TECH AUDIT FIX: Added try/catch and safe JSON parsing
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const numId = Number(id);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid file ID" }, { status: 400 });

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    // TECH AUDIT FIX: Cast body values to expected types for type safety
    const { filename, folderId, caption, sortOrder } = body;
    await updateDriveFile(numId, {
      ...(filename !== undefined && { filename: filename as string }),
      ...(folderId !== undefined && { folderId: folderId as number | null }),
      ...(caption !== undefined && { caption: caption as string }),
      ...(sortOrder !== undefined && { sortOrder: sortOrder as number }),
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("PATCH /api/drive/files/[id] error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to update file" }, { status: 500 });
  }
}

// TECH AUDIT FIX: Added try/catch
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const numId = Number(id);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid file ID" }, { status: 400 });
    const file = await getDriveFile(numId);
    if (file) {
      try { await deleteFile(file.storagePath); } catch {}
      await deleteDriveFile(numId);
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("DELETE /api/drive/files/[id] error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
  }
}
