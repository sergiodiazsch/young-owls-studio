import { NextResponse } from "next/server";
import { getScene, replaceSceneElements } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sceneId = Number(id);
  if (isNaN(sceneId)) {
    return NextResponse.json({ error: "Invalid scene id" }, { status: 400 });
  }

  let body: { elements?: unknown; synopsis?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.elements)) {
    return NextResponse.json({ error: "elements must be an array" }, { status: 400 });
  }

  const scene = await getScene(sceneId);
  if (!scene) {
    return NextResponse.json({ error: "Scene not found" }, { status: 404 });
  }

  try {
    await replaceSceneElements(sceneId, body.elements, typeof body.synopsis === "string" ? body.synopsis : undefined);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to apply modification";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
