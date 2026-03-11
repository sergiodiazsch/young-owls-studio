import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import {
  scenes,
  sceneBreakdowns,
  breakdownElements,
} from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { BREAKDOWN_CATEGORIES } from "@/lib/breakdown-categories";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function POST(req: Request) {
  try {
  await ensureSchema();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
  }
  const { projectId, format } = body;

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  if (format !== "csv") {
    return NextResponse.json({ error: "Only CSV format is supported" }, { status: 400 });
  }

  const pid = Number(projectId);

  const projectScenes = await db
    .select()
    .from(scenes)
    .where(eq(scenes.projectId, pid))
    .orderBy(asc(scenes.sortOrder));

  const breakdowns = await db
    .select()
    .from(sceneBreakdowns)
    .where(eq(sceneBreakdowns.projectId, pid));

  const breakdownMap = new Map(breakdowns.map((b) => [b.sceneId, b]));

  // Build CSV
  const rows: string[] = [];

  // Header row
  rows.push(
    [
      "Scene #",
      "Heading",
      "Location",
      "INT/EXT",
      "Day/Night",
      "Page Count",
      "Est. Shoot Hours",
      "Status",
      "Category",
      "Element Name",
      "Element Description",
      "Quantity",
      "Notes",
    ]
      .map(escapeCSV)
      .join(",")
  );

  for (const scene of projectScenes) {
    const breakdown = breakdownMap.get(scene.id);

    if (!breakdown || breakdown.status !== "completed") {
      rows.push(
        [
          scene.sceneNumber,
          scene.heading,
          scene.location,
          scene.headingType,
          scene.timeOfDay,
          "",
          "",
          breakdown?.status || "pending",
          "",
          "",
          "",
          "",
          "",
        ]
          .map(escapeCSV)
          .join(",")
      );
      continue;
    }

    const elements = await db
      .select()
      .from(breakdownElements)
      .where(eq(breakdownElements.breakdownId, breakdown.id))
      .orderBy(asc(breakdownElements.sortOrder));

    if (elements.length === 0) {
      rows.push(
        [
          scene.sceneNumber,
          scene.heading,
          scene.location,
          breakdown.intOrExt,
          breakdown.dayOrNight,
          breakdown.pageCount,
          breakdown.estimatedShootHours,
          breakdown.status,
          "",
          "",
          "",
          "",
          breakdown.notes,
        ]
          .map(escapeCSV)
          .join(",")
      );
    } else {
      for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        const categoryLabel = BREAKDOWN_CATEGORIES[el.category]?.label || el.category;

        rows.push(
          [
            i === 0 ? scene.sceneNumber : "",
            i === 0 ? scene.heading : "",
            i === 0 ? scene.location : "",
            i === 0 ? breakdown.intOrExt : "",
            i === 0 ? breakdown.dayOrNight : "",
            i === 0 ? breakdown.pageCount : "",
            i === 0 ? breakdown.estimatedShootHours : "",
            i === 0 ? breakdown.status : "",
            categoryLabel,
            el.name,
            el.description,
            el.quantity,
            i === 0 ? breakdown.notes : "",
          ]
            .map(escapeCSV)
            .join(",")
        );
      }
    }
  }

  const csv = rows.join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="breakdown-project-${projectId}.csv"`,
    },
  });
  } catch (error: unknown) {
    logger.error("POST /api/breakdowns/export error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to export breakdowns";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
