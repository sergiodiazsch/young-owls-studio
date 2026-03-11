import { NextResponse } from "next/server";
import { getProject } from "@/lib/db/queries";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { saveFile, readFile } from "@/lib/storage";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const numId = Number(id);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });

    const project = await getProject(numId);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Only JPEG, PNG, WebP, and GIF images are allowed" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.type.split("/")[1] === "jpeg" ? ".jpg" : `.${file.type.split("/")[1]}`;
    const { storagePath } = await saveFile(numId, `cover${ext}`, buffer);

    await ensureSchema();
    await db.update(projects)
      .set({ coverImage: storagePath, updatedAt: new Date().toISOString() })
      .where(eq(projects.id, numId));

    return NextResponse.json({ coverImage: storagePath });
  } catch (err) {
    logger.error("POST /api/projects/[id]/cover error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to upload cover" }, { status: 500 });
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const numId = Number(id);
    if (isNaN(numId)) return new Response("Invalid ID", { status: 400 });

    const project = await getProject(numId);
    if (!project || !project.coverImage) return new Response("No cover", { status: 404 });

    const buffer = await readFile(project.coverImage);
    const ext = project.coverImage.split(".").pop()?.toLowerCase();
    const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "gif" ? "image/gif" : "image/jpeg";

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    logger.error("GET /api/projects/[id]/cover error", { error: err instanceof Error ? err.message : String(err) });
    return new Response("Failed to load cover", { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const numId = Number(id);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    await ensureSchema();
    await db.update(projects)
      .set({ coverImage: null, updatedAt: new Date().toISOString() })
      .where(eq(projects.id, numId));

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("DELETE /api/projects/[id]/cover error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to remove cover" }, { status: 500 });
  }
}
