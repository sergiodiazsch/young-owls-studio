import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { sceneColorData } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

interface PatchBody {
  moodTag?: string;
  dominantColors?: Array<{ hex: string; percentage: number; name: string }>;
  brightness?: number;
  saturation?: number;
  warmth?: number;
  averageColor?: string;
}

/** PATCH /api/color-script/[sceneId] — Update color data (manual override, mood tag) */
// TECH AUDIT FIX: Added try/catch and safe JSON parsing
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ sceneId: string }> }
) {
  try {
  await ensureSchema();
  const { sceneId: sceneIdStr } = await params;
  const sceneId = Number(sceneIdStr);

  if (isNaN(sceneId)) {
    return NextResponse.json(
      { error: "Invalid sceneId" },
      { status: 400 }
    );
  }

  let body: PatchBody;
  try { body = (await req.json()) as PatchBody; } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const [existing] = await db
    .select()
    .from(sceneColorData)
    .where(eq(sceneColorData.sceneId, sceneId));

  if (!existing) {
    return NextResponse.json(
      { error: "No color data found for this scene. Extract colors first." },
      { status: 404 }
    );
  }

  const updates: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };

  if (body.moodTag !== undefined) {
    updates.moodTag = body.moodTag;
  }

  if (body.dominantColors !== undefined) {
    updates.dominantColors = JSON.stringify(body.dominantColors);
  }

  if (body.brightness !== undefined) {
    updates.brightness = body.brightness;
  }

  if (body.saturation !== undefined) {
    updates.saturation = body.saturation;
  }

  if (body.warmth !== undefined) {
    updates.warmth = body.warmth;
  }

  if (body.averageColor !== undefined) {
    updates.averageColor = body.averageColor;
  }

  await db.update(sceneColorData)
    .set(updates)
    .where(eq(sceneColorData.id, existing.id));

  const [updated] = await db
    .select()
    .from(sceneColorData)
    .where(eq(sceneColorData.id, existing.id));

  if (!updated) {
    return NextResponse.json(
      { error: "Failed to retrieve updated record" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ...updated,
    dominantColors: JSON.parse(updated.dominantColors),
  });
  } catch (error: unknown) {
    logger.error("PATCH /api/color-script/[sceneId] error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to update color data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
