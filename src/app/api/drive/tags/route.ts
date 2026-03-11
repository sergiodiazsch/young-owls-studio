import { NextResponse } from "next/server";
import { getDriveTags, createDriveTag } from "@/lib/db/queries";
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
    const tags = await getDriveTags(projectId);
    return NextResponse.json(tags);
  } catch (err) {
    logger.error("GET /api/drive/tags error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to fetch tags" }, { status: 500 });
  }
}

// TECH AUDIT FIX: Added try/catch and safe JSON parsing
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

    // TECH AUDIT FIX: Provide default color when none supplied
    const tag = await createDriveTag({ projectId: body.projectId as number, name: body.name as string, color: (body.color as string) || "#808080" });
    return NextResponse.json(tag, { status: 201 });
  } catch (err) {
    logger.error("POST /api/drive/tags error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to create tag" }, { status: 500 });
  }
}
