import { NextResponse } from "next/server";
import {
  getFullVideoEditorProject,
  updateVideoEditorProject,
  deleteVideoEditorProject,
} from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const editorId = Number(id);
  if (isNaN(editorId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const project = await getFullVideoEditorProject(editorId);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(project);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const editorId = Number(id);
    if (isNaN(editorId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    const body = await req.json();
    const allowed = ["title", "description", "width", "height", "fps", "durationMs", "status"];
    const data: Record<string, unknown> = {};
    for (const key of allowed) {
      if (body[key] !== undefined) data[key] = body[key];
    }
    await updateVideoEditorProject(editorId, data);
    const updated = await getFullVideoEditorProject(editorId);
    return NextResponse.json(updated);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const editorId = Number(id);
  if (isNaN(editorId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  await deleteVideoEditorProject(editorId);
  return NextResponse.json({ success: true });
}
