import { NextResponse } from "next/server";
import { getSceneWithElements } from "@/lib/db/queries";
import { db, ensureSchema } from "@/lib/db";
import { scenes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// TECH AUDIT FIX: Added try/catch and ID validation
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchema();
    const { id } = await params;
    const numId = Number(id);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid scene ID" }, { status: 400 });
    const scene = await getSceneWithElements(numId);
    if (!scene) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(scene);
  } catch (err) {
    logger.error("GET /api/scenes/[id] error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to fetch scene" }, { status: 500 });
  }
}

const SCENE_UPDATABLE_FIELDS = [
  "heading", "headingType", "location", "timeOfDay", "section",
  "synopsis", "rawContent", "sortOrder", "sceneNumber",
] as const;

// TECH AUDIT FIX: Added try/catch, safe JSON parsing, and ID validation
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchema();
    const { id } = await params;
    const numId = Number(id);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid scene ID" }, { status: 400 });

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    const allowed: Record<string, unknown> = {};
    for (const key of SCENE_UPDATABLE_FIELDS) {
      if (key in body) allowed[key] = body[key];
    }
    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }
    await db.update(scenes).set(allowed).where(eq(scenes.id, numId));
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("PATCH /api/scenes/[id] error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to update scene" }, { status: 500 });
  }
}
