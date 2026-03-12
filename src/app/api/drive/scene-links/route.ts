import { NextResponse } from "next/server";
import { getSceneFileLinks, createSceneFileLink, deleteSceneFileLink, updateSceneFileLinkReviewStatus } from "@/lib/db/queries";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// TECH AUDIT FIX: Added try/catch and validation
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sceneId = Number(searchParams.get("sceneId"));
    if (!sceneId || isNaN(sceneId)) {
      return NextResponse.json({ error: "sceneId is required" }, { status: 400 });
    }
    const links = await getSceneFileLinks(sceneId);
    return NextResponse.json(links);
  } catch (err) {
    logger.error("GET /api/drive/scene-links error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to fetch scene links" }, { status: 500 });
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

    const { sceneId, fileId } = body;
    if (!sceneId || !fileId) {
      return NextResponse.json({ error: "sceneId and fileId are required" }, { status: 400 });
    }

    const link = await createSceneFileLink(sceneId as number, fileId as number);
    return NextResponse.json(link, { status: 201 });
  } catch (err) {
    logger.error("POST /api/drive/scene-links error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to create scene link" }, { status: 500 });
  }
}

// TECH AUDIT FIX: Added try/catch and safe JSON parsing
export async function DELETE(req: Request) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    const { id } = body;
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    await deleteSceneFileLink(id as number);
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("DELETE /api/drive/scene-links error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to delete scene link" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { id, reviewStatus } = await req.json();
    if (!id || isNaN(Number(id))) return NextResponse.json({ error: "id required" }, { status: 400 });
    if (!["approved", "rejected", "pending"].includes(reviewStatus)) {
      return NextResponse.json({ error: "Invalid reviewStatus" }, { status: 400 });
    }
    const updated = await updateSceneFileLinkReviewStatus(Number(id), reviewStatus);
    return NextResponse.json(updated);
  } catch (err: unknown) {
    logger.error("PATCH /api/drive/scene-links", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
