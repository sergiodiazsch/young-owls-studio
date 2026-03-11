import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { locations, sceneLocations, scenes, dialogues, directions } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { logger } from "@/lib/logger";
import { getSetting } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

// TECH AUDIT FIX: Added outer try/catch and ID validation to POST
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  await ensureSchema();
  const { id } = await params;
  const locationId = Number(id);
  if (isNaN(locationId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const [location] = await db
    .select()
    .from(locations)
    .where(eq(locations.id, locationId));

  if (!location) {
    return NextResponse.json({ error: "Location not found" }, { status: 404 });
  }

  // Load all scenes at this location with their elements
  const linkedScenes = await db
    .select({
      id: scenes.id,
      sceneNumber: scenes.sceneNumber,
      heading: scenes.heading,
      timeOfDay: scenes.timeOfDay,
      synopsis: scenes.synopsis,
      rawContent: scenes.rawContent,
    })
    .from(sceneLocations)
    .innerJoin(scenes, eq(sceneLocations.sceneId, scenes.id))
    .where(eq(sceneLocations.locationId, locationId))
    .orderBy(asc(scenes.sortOrder));

  // Build context from scene content
  const sceneContextParts: string[] = [];
  for (const scene of linkedScenes) {
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

    let context = `Scene ${scene.sceneNumber}: ${scene.heading}\n`;
    if (scene.synopsis) context += `Synopsis: ${scene.synopsis}\n`;

    // Collect action descriptions which describe the setting
    const actionDescriptions = sceneDirections
      .filter(d => d.type === "action")
      .map(d => d.content)
      .join("\n");
    if (actionDescriptions) context += `Actions/Descriptions:\n${actionDescriptions}\n`;

    // Include a few dialogue lines for atmosphere
    const sampleDialogues = sceneDialogues.slice(0, 3);
    if (sampleDialogues.length > 0) {
      context += "Sample dialogue:\n";
      for (const d of sampleDialogues) {
        context += `  ${d.character}: ${d.line}\n`;
      }
    }

    sceneContextParts.push(context);
  }

  const fullContext = sceneContextParts.join("\n---\n");

  // Call Claude to generate a visual prompt
  const setting = await getSetting("anthropic_api_key");
  const apiKey = setting?.value || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Anthropic API key not configured" }, { status: 500 });
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 800,
    messages: [
      {
        role: "user",
        content: `You are a production designer for film/TV. Based on the following screenplay scenes that take place at the location "${location.name}", write a detailed visual description of this location. Include:
- Physical setting and architecture
- Atmosphere and mood
- Lighting conditions
- Key visual elements and props
- Color palette suggestions
- Time period / style indicators

This description will be used as a reference for concept art generation and location scouting.

SCENES AT THIS LOCATION:
${fullContext}

${location.description ? `EXISTING DESCRIPTION:\n${location.description}\n` : ""}
${location.styleNotes ? `STYLE NOTES:\n${location.styleNotes}\n` : ""}

Respond with ONLY the visual description, no explanation or preamble.`,
      },
    ],
  });

  const textBlock = response.content.find(block => block.type === "text");
  const visualPrompt = textBlock && textBlock.type === "text" ? textBlock.text : "";

  // Update the location
  await db.update(locations)
    .set({ visualPrompt, updatedAt: new Date().toISOString() })
    .where(eq(locations.id, locationId));

  return NextResponse.json({ visualPrompt });
  } catch (error: unknown) {
    logger.error("POST /api/locations/[id]/generate-prompt error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to generate location prompt";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
