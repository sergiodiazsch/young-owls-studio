import { NextResponse } from "next/server";
import { db, pool, ensureSchema } from "@/lib/db";
import { sceneBreakdowns, scenes, breakdownElements } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// Reset stuck/failed breakdowns back to pending so they can be retried
export async function PATCH(req: Request) {
  try {
    await ensureSchema();
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    const { projectId, action } = body;
    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const pid = Number(projectId);
    if (isNaN(pid)) return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });

    if (action === "reset-failed") {
      // Reset all failed breakdowns to pending
      const allBreakdowns = await db.select().from(sceneBreakdowns).where(eq(sceneBreakdowns.projectId, pid));
      let resetCount = 0;
      for (const b of allBreakdowns) {
        if (b.status === "failed" || b.status === "generating") {
          await db.update(sceneBreakdowns)
            .set({ status: "pending", notes: null, updatedAt: new Date().toISOString() })
            .where(eq(sceneBreakdowns.id, b.id));
          resetCount++;
        }
      }
      return NextResponse.json({ reset: resetCount });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : typeof error === "object" && error !== null ? JSON.stringify(error) : String(error);
    logger.error("PATCH /api/breakdowns error", { error: errMsg });
    return NextResponse.json({ error: errMsg || "Failed to reset breakdowns" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
  await ensureSchema();
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const pid = Number(projectId);
  if (isNaN(pid)) return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });

  // Get all scenes for project
  const projectScenes = await db
    .select()
    .from(scenes)
    .where(eq(scenes.projectId, pid))
    .orderBy(asc(scenes.sortOrder));

  // Get all breakdowns for project
  const breakdowns = await db
    .select()
    .from(sceneBreakdowns)
    .where(eq(sceneBreakdowns.projectId, pid));

  // Auto-reset stale "generating" breakdowns (stuck for > 5 minutes) to "failed"
  const STALE_THRESHOLD_MS = 5 * 60 * 1000;
  const now = Date.now();
  for (const b of breakdowns) {
    if (b.status === "generating") {
      const updatedAt = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      if (now - updatedAt > STALE_THRESHOLD_MS) {
        await db.update(sceneBreakdowns)
          .set({ status: "failed", notes: "Generation timed out or was interrupted", updatedAt: new Date().toISOString() })
          .where(eq(sceneBreakdowns.id, b.id));
        b.status = "failed";
        b.notes = "Generation timed out or was interrupted";
      }
    }
  }

  // Get all elements for all breakdowns in a single efficient query
  const breakdownIds = breakdowns.map((b) => b.id);
  const elementsByBreakdown: Record<number, Array<typeof breakdownElements.$inferSelect>> = {};

  if (breakdownIds.length > 0) {
    if (breakdownIds.length === 1) {
      elementsByBreakdown[breakdownIds[0]] = await db
        .select()
        .from(breakdownElements)
        .where(eq(breakdownElements.breakdownId, breakdownIds[0]))
        .orderBy(asc(breakdownElements.sortOrder));
    } else {
      const CHUNK_SIZE = 500;
      for (let i = 0; i < breakdownIds.length; i += CHUNK_SIZE) {
        const chunk = breakdownIds.slice(i, i + CHUNK_SIZE);
        const placeholders = chunk.map((_, idx) => `$${idx + 1}`).join(",");
        const { rows } = await pool.query(
          `SELECT id, breakdown_id, category, name, description, quantity, is_custom, sort_order, created_at
           FROM breakdown_elements WHERE breakdown_id IN (${placeholders}) ORDER BY sort_order ASC`,
          chunk
        );
        for (const row of rows) {
          if (!elementsByBreakdown[row.breakdown_id]) elementsByBreakdown[row.breakdown_id] = [];
          elementsByBreakdown[row.breakdown_id].push({
            id: row.id,
            breakdownId: row.breakdown_id,
            category: row.category,
            name: row.name,
            description: row.description,
            quantity: row.quantity,
            isCustom: row.is_custom,
            sortOrder: row.sort_order,
            createdAt: row.created_at,
          });
        }
      }
    }
  }

  // Build breakdown lookup by sceneId
  const breakdownByScene: Record<number, typeof breakdowns[0] & { elements: Array<typeof breakdownElements.$inferSelect> }> = {};
  for (const b of breakdowns) {
    breakdownByScene[b.sceneId] = {
      ...b,
      elements: elementsByBreakdown[b.id] || [],
    };
  }

  // Merge scenes with their breakdowns
  const result = projectScenes.map((scene) => ({
    scene,
    breakdown: breakdownByScene[scene.id] || null,
  }));

  return NextResponse.json(result);
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : typeof error === "object" && error !== null ? JSON.stringify(error) : String(error);
    logger.error("GET /api/breakdowns error", { error: errMsg });
    return NextResponse.json({ error: errMsg || "Failed to fetch breakdowns" }, { status: 500 });
  }
}
