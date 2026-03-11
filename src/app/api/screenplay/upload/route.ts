import { NextResponse } from "next/server";
import { extractTextFromDocx } from "@/lib/docx";
import { createProject } from "@/lib/db/queries";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// TECH AUDIT FIX: Wrapped entire handler in try/catch for formData and DB errors
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.name.endsWith(".docx")) {
      return NextResponse.json({ error: "Only .docx files are supported" }, { status: 400 });
    }

    // TECH AUDIT FIX: Add file size limit for screenplay uploads (10MB should be plenty for any docx)
    const MAX_DOCX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_DOCX_SIZE) {
      return NextResponse.json({ error: "File too large (max 10MB for .docx)" }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const rawText = await extractTextFromDocx(buffer);

    // Create project with raw text — title will be updated after parsing
    const project = await createProject({
      title: file.name.replace(/\.docx$/i, "").replace(/[_-]/g, " "),
      rawText,
      originalFilename: file.name,
    });

    return NextResponse.json({ projectId: project.id, rawText, filename: file.name }, { status: 201 });
  } catch (err) {
    logger.error("POST /api/screenplay/upload error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to upload screenplay" }, { status: 500 });
  }
}
