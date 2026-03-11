import { NextResponse } from "next/server";
import { getVideoEditorProjects, createVideoEditorProject } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = Number(searchParams.get("projectId"));
  if (!projectId || isNaN(projectId)) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }
  const projects = await getVideoEditorProjects(projectId);
  return NextResponse.json(projects);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { projectId, title, description, width, height, fps } = body;
    if (!projectId || !title) {
      return NextResponse.json({ error: "projectId and title are required" }, { status: 400 });
    }
    const project = await createVideoEditorProject({
      projectId: Number(projectId),
      title: String(title).slice(0, 200),
      description: description ? String(description).slice(0, 1000) : undefined,
      width: width ? Number(width) : undefined,
      height: height ? Number(height) : undefined,
      fps: fps ? Number(fps) : undefined,
    });
    return NextResponse.json(project, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create editor project";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
