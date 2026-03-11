import { NextResponse } from "next/server";
import { getDriveFolders, createDriveFolder } from "@/lib/db/queries";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// TECH AUDIT FIX: Added try/catch and validation
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = Number(searchParams.get("projectId"));
    if (!projectId || isNaN(projectId)) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }
    const parentId = searchParams.get("parentId") ? Number(searchParams.get("parentId")) : null;
    const folders = await getDriveFolders(projectId, parentId);
    return NextResponse.json(folders);
  } catch (err) {
    logger.error("GET /api/drive/folders error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to fetch folders" }, { status: 500 });
  }
}

// TECH AUDIT FIX: Added try/catch, safe JSON parsing, and input validation
export async function POST(req: Request) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    if (!body.projectId || !body.name) {
      return NextResponse.json({ error: "projectId and name are required" }, { status: 400 });
    }

    const folder = await createDriveFolder({
      projectId: body.projectId as number,
      parentId: (body.parentId as number) ?? null,
      name: body.name as string,
      icon: body.icon as string | undefined,
    });
    return NextResponse.json(folder, { status: 201 });
  } catch (err) {
    logger.error("POST /api/drive/folders error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to create folder" }, { status: 500 });
  }
}
