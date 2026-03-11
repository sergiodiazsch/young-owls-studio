import { NextResponse } from "next/server";
import { updateVideoEditorClip, deleteVideoEditorClip } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const clipId = Number(id);
    if (isNaN(clipId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    const body = await req.json();
    const allowed = [
      "trackId", "name", "startMs", "durationMs", "sourceStartMs", "sourceEndMs",
      "volume", "opacity", "playbackRate", "textContent", "textStyle", "filters",
      "transition", "sortOrder",
    ];
    const data: Record<string, unknown> = {};
    for (const key of allowed) {
      if (body[key] !== undefined) data[key] = body[key];
    }
    await updateVideoEditorClip(clipId, data);
    return NextResponse.json({ success: true });
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
  const clipId = Number(id);
  if (isNaN(clipId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  await deleteVideoEditorClip(clipId);
  return NextResponse.json({ success: true });
}
