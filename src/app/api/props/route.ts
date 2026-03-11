import { NextResponse } from "next/server";
import { getPropsByProject, createProp } from "@/lib/db/queries";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const pid = Number(projectId);
    if (isNaN(pid)) return NextResponse.json({ error: "projectId must be a number" }, { status: 400 });

    const props = await getPropsByProject(pid);
    return NextResponse.json(props);
  } catch (err) {
    logger.error("GET /api/props error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to fetch props" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
  }

  if (!body.projectId || !body.name) {
    return NextResponse.json({ error: "projectId and name required" }, { status: 400 });
  }

  try {
    const prop = await createProp({
      projectId: body.projectId as number,
      name: body.name as string,
      description: body.description as string | undefined,
      tags: body.tags as string | undefined,
      aiGenerationNotes: body.aiGenerationNotes as string | undefined,
    });
    return NextResponse.json(prop, { status: 201 });
  } catch (err) {
    logger.error("POST /api/props error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to create prop" }, { status: 500 });
  }
}
