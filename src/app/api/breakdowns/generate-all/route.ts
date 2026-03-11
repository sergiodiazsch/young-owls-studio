import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import {
  scenes,
  sceneBreakdowns,
  breakdownElements,
  dialogues,
  directions,
} from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { getSetting } from "@/lib/db/queries";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BREAKDOWN_TOOL: Anthropic.Tool = {
  name: "scene_breakdown",
  description:
    "Extract all production elements from a screenplay scene for a professional scene breakdown / stripboard.",
  input_schema: {
    type: "object" as const,
    required: ["elements", "metadata"],
    properties: {
      metadata: {
        type: "object",
        required: ["pageCount", "dayOrNight", "intOrExt", "estimatedShootHours"],
        properties: {
          pageCount: { type: "number" },
          dayOrNight: {
            type: "string",
            enum: ["DAY", "NIGHT", "DAWN", "DUSK", "MORNING", "EVENING", "CONTINUOUS"],
          },
          intOrExt: { type: "string", enum: ["INT", "EXT", "INT/EXT"] },
          estimatedShootHours: { type: "number" },
        },
      },
      elements: {
        type: "array",
        items: {
          type: "object",
          required: ["category", "name"],
          properties: {
            category: {
              type: "string",
              enum: [
                "cast_speaking", "cast_silent", "cast_atmosphere", "stunts",
                "special_effects", "visual_effects", "props", "set_dressing",
                "wardrobe", "makeup_hair", "vehicles", "animals", "weapons",
                "music", "sound_effects", "special_equipment", "greenscreen",
                "additional_labor", "notes",
              ],
            },
            name: { type: "string" },
            description: { type: "string" },
            quantity: { type: "number" },
          },
        },
      },
    },
  },
};

async function processScene(
  client: Anthropic,
  scene: {
    id: number;
    projectId: number;
    heading: string;
    location: string | null;
    timeOfDay: string | null;
    synopsis: string | null;
  }
) {
  // Load elements
  const sceneDialogues = await db
    .select()
    .from(dialogues)
    .where(eq(dialogues.sceneId, scene.id))
    .orderBy(asc(dialogues.sortOrder));

  const sceneDirections = await db
    .select()
    .from(directions)
    .where(eq(directions.sceneId, scene.id))
    .orderBy(asc(directions.sortOrder));

  const allElements = [
    ...sceneDialogues.map((d) => ({ ...d, _kind: "dialogue" as const })),
    ...sceneDirections.map((d) => ({ ...d, _kind: "direction" as const })),
  ].sort((a, b) => a.sortOrder - b.sortOrder);

  let sceneText = `SCENE HEADING: ${scene.heading}\n`;
  if (scene.location) sceneText += `LOCATION: ${scene.location}\n`;
  if (scene.timeOfDay) sceneText += `TIME OF DAY: ${scene.timeOfDay}\n`;
  if (scene.synopsis) sceneText += `SYNOPSIS: ${scene.synopsis}\n`;
  sceneText += "\nSCRIPT CONTENT:\n";

  for (const el of allElements) {
    if (el._kind === "dialogue") {
      const d = el as (typeof sceneDialogues)[0] & { _kind: "dialogue" };
      sceneText += `\n${d.character}${d.parenthetical ? ` ${d.parenthetical}` : ""}\n${d.line}\n`;
    } else {
      const d = el as (typeof sceneDirections)[0] & { _kind: "direction" };
      sceneText += `\n[${d.type.toUpperCase()}] ${d.content}\n`;
    }
  }

  // Create or update breakdown record
  let [breakdown] = await db
    .select()
    .from(sceneBreakdowns)
    .where(eq(sceneBreakdowns.sceneId, scene.id));

  if (breakdown) {
    await db.update(sceneBreakdowns)
      .set({ status: "generating", updatedAt: new Date().toISOString() })
      .where(eq(sceneBreakdowns.id, breakdown.id));
  } else {
    [breakdown] = await db
      .insert(sceneBreakdowns)
      .values({
        sceneId: scene.id,
        projectId: scene.projectId,
        status: "generating",
      })
      .returning();
  }

  try {
    // Add per-scene timeout (90s) to prevent hanging forever
    const PER_SCENE_TIMEOUT_MS = 90_000;
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), PER_SCENE_TIMEOUT_MS);

    let response: Anthropic.Message;
    try {
      response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8000,
        tool_choice: { type: "tool", name: "scene_breakdown" },
        tools: [BREAKDOWN_TOOL],
        system:
          "You are a professional 1st Assistant Director performing a scene breakdown for a production. Carefully analyze the screenplay scene and extract ALL production elements needed. Be thorough.",
        messages: [
          {
            role: "user",
            content: `Perform a complete scene breakdown for the following screenplay scene.\n\n${sceneText}`,
          },
        ],
      }, { signal: abortController.signal });
    } finally {
      clearTimeout(timeout);
    }

    const toolUse = response.content.find((block) => block.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error("No structured output from Claude");
    }

    const result = toolUse.input as {
      metadata: {
        pageCount: number;
        dayOrNight: string;
        intOrExt: string;
        estimatedShootHours: number;
      };
      elements: Array<{
        category: string;
        name: string;
        description?: string;
        quantity?: number;
      }>;
    };

    await db.update(sceneBreakdowns)
      .set({
        status: "completed",
        pageCount: result.metadata.pageCount,
        dayOrNight: result.metadata.dayOrNight,
        intOrExt: result.metadata.intOrExt,
        estimatedShootHours: result.metadata.estimatedShootHours,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(sceneBreakdowns.id, breakdown.id));

    await db.delete(breakdownElements)
      .where(eq(breakdownElements.breakdownId, breakdown.id));

    for (let i = 0; i < result.elements.length; i++) {
      const el = result.elements[i];
      await db.insert(breakdownElements)
        .values({
          breakdownId: breakdown.id,
          category: el.category,
          name: el.name,
          description: el.description || null,
          quantity: el.quantity || 1,
          isCustom: 0,
          sortOrder: i,
        });
    }

    return { sceneId: scene.id, status: "completed" as const };
  } catch (error: unknown) {
    await db.update(sceneBreakdowns)
      .set({
        status: "failed",
        notes: error instanceof Error ? error.message : "Unknown error",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(sceneBreakdowns.id, breakdown.id));

    return {
      sceneId: scene.id,
      status: "failed" as const,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
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
  const { projectId } = body;

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const projectScenes = await db
    .select()
    .from(scenes)
    .where(eq(scenes.projectId, Number(projectId)))
    .orderBy(asc(scenes.sortOrder));

  if (projectScenes.length === 0) {
    return NextResponse.json({ error: "No scenes found" }, { status: 404 });
  }

  const setting = await getSetting("anthropic_api_key");
  const apiKey = setting?.value || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Anthropic API key not configured" }, { status: 500 });
  const client = new Anthropic({ apiKey });
  const results: Array<{ sceneId: number; status: string; error?: string }> = [];

  // Process scenes with max 2 concurrent
  const CONCURRENCY = 2;
  for (let i = 0; i < projectScenes.length; i += CONCURRENCY) {
    const batch = projectScenes.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((scene) => processScene(client, scene))
    );
    results.push(...batchResults);
  }

  const completed = results.filter((r) => r.status === "completed").length;
  const failed = results.filter((r) => r.status === "failed").length;

  return NextResponse.json({
    total: projectScenes.length,
    completed,
    failed,
    results,
  });
  } catch (error: unknown) {
    logger.error("POST /api/breakdowns/generate-all error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to generate breakdowns";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
