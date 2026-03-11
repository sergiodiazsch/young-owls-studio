import { NextResponse } from "next/server";
import { getImageGenerations } from "@/lib/db/queries";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// TECH AUDIT FIX: Added try/catch and NaN validation to GET
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    const numId = Number(projectId);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });

    const favoritesOnly = searchParams.get("favorites") === "true";
    const batchId = searchParams.get("batchId") || undefined;
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);
    const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);

    const generations = await getImageGenerations(numId, { favoritesOnly, batchId }, limit, offset);

    // Parse tags JSON string into arrays for the client
    const parsed = generations.map((g) => ({
      ...g,
      tags: g.tags ? (() => { try { return JSON.parse(g.tags as string); } catch { return null; } })() : null,
    }));

    return NextResponse.json(parsed);
  } catch (error: unknown) {
    logger.error("GET /api/generate/image/generations error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to fetch image generations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
