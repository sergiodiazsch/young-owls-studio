import { NextResponse } from "next/server";
import { getVideoEditorTracks, createVideoEditorTrack } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const editorProjectId = Number(searchParams.get("editorProjectId"));
  if (!editorProjectId || isNaN(editorProjectId)) {
    return NextResponse.json({ error: "editorProjectId is required" }, { status: 400 });
  }
  return NextResponse.json(await getVideoEditorTracks(editorProjectId));
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { editorProjectId, type, name, sortOrder } = body;
    if (!editorProjectId || !type || !name) {
      return NextResponse.json({ error: "editorProjectId, type, and name are required" }, { status: 400 });
    }
    const validTypes = ["video", "audio", "text", "overlay"];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: "Invalid track type" }, { status: 400 });
    }
    const track = await createVideoEditorTrack({
      editorProjectId: Number(editorProjectId),
      type: String(type),
      name: String(name).slice(0, 100),
      sortOrder: sortOrder !== undefined ? Number(sortOrder) : undefined,
    });
    return NextResponse.json(track, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create track";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
