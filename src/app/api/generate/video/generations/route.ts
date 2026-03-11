import { NextResponse } from "next/server";
import { getVideoGenerations } from "@/lib/db/queries";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// TECH AUDIT FIX: Added try/catch and NaN validation to GET
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

    const numId = Number(projectId);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });

    const favorites = searchParams.get("favorites") === "true";
    const generations = await getVideoGenerations(numId, { favoritesOnly: favorites });

    // Parse tags JSON for client
    const parsed = generations.map((g) => ({
      ...g,
      tags: g.tags ? (() => { try { return JSON.parse(g.tags); } catch { return null; } })() : null,
    }));

    return NextResponse.json(parsed);
  } catch (error: unknown) {
    logger.error("GET /api/generate/video/generations error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to fetch video generations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
