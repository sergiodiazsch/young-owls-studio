import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import {
  scenes,
  sceneBreakdowns,
  breakdownElements,
} from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

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

  const projectScenes = await db
    .select()
    .from(scenes)
    .where(eq(scenes.projectId, pid))
    .orderBy(asc(scenes.sortOrder));

  const breakdowns = await db
    .select()
    .from(sceneBreakdowns)
    .where(eq(sceneBreakdowns.projectId, pid));

  const completedBreakdowns = breakdowns.filter((b) => b.status === "completed");

  // Aggregate page count and shoot hours
  let totalPageCount = 0;
  let totalEstimatedShootHours = 0;
  let dayCount = 0;
  let nightCount = 0;
  const uniqueLocations = new Set<string>();

  for (const b of completedBreakdowns) {
    if (b.pageCount) totalPageCount += b.pageCount;
    if (b.estimatedShootHours) totalEstimatedShootHours += b.estimatedShootHours;
    if (b.dayOrNight) {
      const tod = b.dayOrNight.toUpperCase().trim();
      if (tod === "DAY" || tod === "MORNING" || tod === "DAWN") {
        dayCount++;
      } else if (tod === "NIGHT" || tod === "EVENING" || tod === "DUSK") {
        nightCount++;
      }
    }
  }

  // Get locations from scenes
  for (const scene of projectScenes) {
    if (scene.location) uniqueLocations.add(scene.location);
  }

  // Gather all elements to build cast list and category counts
  const allCast: Set<string> = new Set();
  const elementsByCategory: Record<string, number> = {};

  for (const b of completedBreakdowns) {
    const elements = await db
      .select()
      .from(breakdownElements)
      .where(eq(breakdownElements.breakdownId, b.id));

    for (const el of elements) {
      // Count by category
      elementsByCategory[el.category] = (elementsByCategory[el.category] || 0) + 1;

      // Collect cast from traditional breakdown categories
      if (
        el.category === "cast_speaking" ||
        el.category === "cast_silent" ||
        el.category === "cast_atmosphere"
      ) {
        allCast.add(el.name);
      }

      // Collect cast from video breakdown dialogue elements
      // Format: "CHARACTER: \"line\""
      if (el.category === "dialogue" && el.name) {
        const colonIdx = el.name.indexOf(":");
        if (colonIdx > 0) {
          allCast.add(el.name.slice(0, colonIdx).trim());
        }
      }
    }
  }

  return NextResponse.json({
    totalScenes: projectScenes.length,
    completedBreakdowns: completedBreakdowns.length,
    totalPageCount: Math.round(totalPageCount * 10) / 10,
    totalEstimatedShootHours: Math.round(totalEstimatedShootHours * 10) / 10,
    uniqueLocations: Array.from(uniqueLocations),
    castList: Array.from(allCast).sort(),
    elementsByCategory,
    dayNightSplit: { day: dayCount, night: nightCount },
  });
  } catch (error: unknown) {
    logger.error("GET /api/breakdowns/summary error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to fetch breakdown summary";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
