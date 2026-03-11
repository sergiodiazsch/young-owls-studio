import { NextResponse } from "next/server";
import { getVoiceGenerationsByScene } from "@/lib/db/queries";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// TECH AUDIT FIX: Added try/catch and NaN validation to GET
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sceneId = searchParams.get("sceneId");
    if (!sceneId) return NextResponse.json({ error: "sceneId required" }, { status: 400 });

    const numId = Number(sceneId);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid sceneId" }, { status: 400 });

    const generations = await getVoiceGenerationsByScene(numId);
    return NextResponse.json(generations);
  } catch (error: unknown) {
    logger.error("GET /api/voices/generations error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to fetch voice generations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
