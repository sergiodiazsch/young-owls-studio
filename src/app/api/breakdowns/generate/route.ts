import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import {
  sceneBreakdowns,
  scenes,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Breakdown generation — fire-and-forget architecture.
 *
 * Instead of doing the Claude call inline (which gets killed by Netlify's
 * 10-26s serverless timeout), we:
 * 1. Create/update the breakdown record to "generating"
 * 2. Trigger a Netlify Background Function (up to 15 min execution)
 * 3. Return immediately
 *
 * The frontend polls /api/breakdowns for status changes.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
  }
  const { sceneId, projectId } = body;

  if (!sceneId || !projectId) {
    return NextResponse.json(
      { error: "sceneId and projectId are required" },
      { status: 400 }
    );
  }

  try {
    await ensureSchema();

    // Verify scene exists
    const [scene] = await db.select().from(scenes).where(eq(scenes.id, Number(sceneId)));
    if (!scene) {
      return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    }

    // Create or update breakdown record
    let [breakdown] = await db.select().from(sceneBreakdowns).where(eq(sceneBreakdowns.sceneId, Number(sceneId)));
    if (breakdown) {
      await db.update(sceneBreakdowns)
        .set({ status: "generating", notes: null, updatedAt: new Date().toISOString() })
        .where(eq(sceneBreakdowns.id, breakdown.id));
    } else {
      [breakdown] = await db.insert(sceneBreakdowns)
        .values({ sceneId: Number(sceneId), projectId: Number(projectId), status: "generating" })
        .returning();
    }

    // Trigger Netlify Background Function (fire-and-forget)
    const siteUrl = process.env.URL || process.env.NEXT_PUBLIC_SITE_URL || "";
    const bgUrl = `${siteUrl}/.netlify/functions/breakdown-worker-background`;

    logger.info(`[breakdowns/generate] Triggering background worker for scene ${sceneId} at ${bgUrl}`);

    // Fire and forget — don't await, don't care about the 202 response
    fetch(bgUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sceneId: Number(sceneId),
        projectId: Number(projectId),
        breakdownId: breakdown.id,
      }),
    }).catch((err) => {
      logger.error(`[breakdowns/generate] Failed to trigger background worker: ${err instanceof Error ? err.message : String(err)}`);
    });

    // Return immediately — frontend will poll for completion
    return NextResponse.json({
      status: "generating",
      breakdownId: breakdown.id,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to start breakdown generation";
    logger.error(`[breakdowns/generate] Error: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
