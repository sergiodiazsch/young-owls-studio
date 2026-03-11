import { NextResponse } from "next/server";
import { getVideoEditorClips, createVideoEditorClip } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const editorProjectId = Number(searchParams.get("editorProjectId"));
  if (!editorProjectId || isNaN(editorProjectId)) {
    return NextResponse.json({ error: "editorProjectId is required" }, { status: 400 });
  }
  return NextResponse.json(await getVideoEditorClips(editorProjectId));
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { trackId, editorProjectId, type, name, startMs, durationMs } = body;
    if (!trackId || !editorProjectId || !type || durationMs === undefined) {
      return NextResponse.json({ error: "trackId, editorProjectId, type, and durationMs are required" }, { status: 400 });
    }
    const validTypes = ["video", "audio", "image", "text", "subtitle"];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: "Invalid clip type" }, { status: 400 });
    }
    const clip = await createVideoEditorClip({
      trackId: Number(trackId),
      editorProjectId: Number(editorProjectId),
      type: String(type),
      name: name ? String(name).slice(0, 200) : undefined,
      startMs: Number(startMs) || 0,
      durationMs: Number(durationMs),
      sourceStartMs: body.sourceStartMs !== undefined ? Number(body.sourceStartMs) : undefined,
      sourceEndMs: body.sourceEndMs !== undefined ? Number(body.sourceEndMs) : undefined,
      sourcePath: body.sourcePath ? String(body.sourcePath) : undefined,
      sourceType: body.sourceType ? String(body.sourceType) : undefined,
      sourceId: body.sourceId !== undefined ? Number(body.sourceId) : undefined,
      volume: body.volume !== undefined ? Number(body.volume) : undefined,
      opacity: body.opacity !== undefined ? Number(body.opacity) : undefined,
      playbackRate: body.playbackRate !== undefined ? Number(body.playbackRate) : undefined,
      textContent: body.textContent ? String(body.textContent) : undefined,
      textStyle: body.textStyle ? JSON.stringify(body.textStyle) : undefined,
    });
    return NextResponse.json(clip, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create clip";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
