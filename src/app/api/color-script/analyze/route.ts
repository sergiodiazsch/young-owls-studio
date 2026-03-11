import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db, ensureSchema } from "@/lib/db";
import { sceneColorData, scenes } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { getSetting } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

async function getAnthropicClient(): Promise<Anthropic> {
  const setting = await getSetting("anthropic_api_key");
  const apiKey = setting?.value || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Anthropic API key not configured.");
  return new Anthropic({ apiKey });
}

interface ColorAnalysisResult {
  overallMood: string;
  colorProgression: string;
  patterns: Array<{
    name: string;
    description: string;
    sceneRange: string;
  }>;
  suggestions: Array<{
    type: "consistency" | "contrast" | "mood" | "pacing";
    description: string;
    affectedScenes: number[];
  }>;
  emotionalArc: string;
  paletteNotes: string;
}

const COLOR_ANALYSIS_TOOL: Anthropic.Tool = {
  name: "color_script_analysis",
  description:
    "Analyze the color progression across a screenplay's scenes based on extracted color data. Identify patterns, mood shifts, and suggest improvements.",
  input_schema: {
    type: "object" as const,
    required: [
      "overallMood",
      "colorProgression",
      "patterns",
      "suggestions",
      "emotionalArc",
      "paletteNotes",
    ],
    properties: {
      overallMood: {
        type: "string",
        description:
          "Overall mood/tone conveyed by the color palette across all scenes",
      },
      colorProgression: {
        type: "string",
        description:
          "Narrative description of how colors progress through the story (2-4 sentences)",
      },
      patterns: {
        type: "array",
        description: "Identified visual patterns in the color script",
        items: {
          type: "object",
          required: ["name", "description", "sceneRange"],
          properties: {
            name: {
              type: "string",
              description: "Short name for the pattern",
            },
            description: {
              type: "string",
              description: "What the pattern conveys emotionally/narratively",
            },
            sceneRange: {
              type: "string",
              description: 'Which scenes this covers, e.g. "Scenes 1-5"',
            },
          },
        },
      },
      suggestions: {
        type: "array",
        description:
          "Actionable suggestions for improving the visual color narrative",
        items: {
          type: "object",
          required: ["type", "description", "affectedScenes"],
          properties: {
            type: {
              type: "string",
              enum: ["consistency", "contrast", "mood", "pacing"],
            },
            description: { type: "string" },
            affectedScenes: {
              type: "array",
              items: { type: "number" },
              description: "Scene numbers affected",
            },
          },
        },
      },
      emotionalArc: {
        type: "string",
        description:
          "How the brightness/warmth/saturation curves map to the emotional arc of the story",
      },
      paletteNotes: {
        type: "string",
        description:
          "Notes about the overall palette: dominant colors, consistency, color symbolism used",
      },
    },
  },
};

/** POST /api/color-script/analyze — AI analysis of color progression */
// TECH AUDIT FIX: Added try/catch, NaN validation, and safe JSON parsing
export async function POST(req: Request) {
  try {
  await ensureSchema();

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const projectId = Number(body.projectId);

  if (!projectId || isNaN(projectId)) {
    return NextResponse.json(
      { error: "projectId is required" },
      { status: 400 }
    );
  }

  // Get all scenes + color data
  const projectScenes = await db
    .select()
    .from(scenes)
    .where(eq(scenes.projectId, projectId))
    .orderBy(asc(scenes.sortOrder));

  const colorRows = await db
    .select()
    .from(sceneColorData)
    .where(eq(sceneColorData.projectId, projectId));

  const colorMap = new Map(colorRows.map((cd) => [cd.sceneId, cd]));

  // Build context string for Claude
  const sceneDescriptions = projectScenes
    .map((scene) => {
      const cd = colorMap.get(scene.id);
      if (!cd) {
        return `Scene ${scene.sceneNumber} (${scene.heading}): No color data`;
      }
      const colors = JSON.parse(cd.dominantColors) as Array<{
        hex: string;
        percentage: number;
        name: string;
      }>;
      const colorStr = colors
        .map((c) => `${c.name} ${c.hex} (${c.percentage}%)`)
        .join(", ");
      return `Scene ${scene.sceneNumber} (${scene.heading}, ${scene.timeOfDay || "unspecified"}):
  Average: ${cd.averageColor}
  Dominant: ${colorStr}
  Brightness: ${cd.brightness?.toFixed(2)} | Saturation: ${cd.saturation?.toFixed(2)} | Warmth: ${cd.warmth?.toFixed(2)}
  Mood: ${cd.moodTag || "untagged"}`;
    })
    .join("\n\n");

  const scenesWithColor = colorRows.length;
  if (scenesWithColor < 2) {
    return NextResponse.json(
      {
        error:
          "Need color data from at least 2 scenes to perform analysis. Extract colors first.",
      },
      { status: 400 }
    );
  }

  const client = await getAnthropicClient();

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    tool_choice: { type: "tool", name: "color_script_analysis" },
    tools: [COLOR_ANALYSIS_TOOL],
    messages: [
      {
        role: "user",
        content: `You are a cinematographer and visual storytelling expert. Analyze the color progression across this screenplay's scenes. The color data was extracted from concept images linked to each scene.

Total scenes: ${projectScenes.length}
Scenes with color data: ${scenesWithColor}

COLOR DATA BY SCENE:
${sceneDescriptions}

Analyze:
1. The overall visual mood and tone
2. How colors progress through the narrative (warming, cooling, desaturation patterns)
3. Identify specific patterns (e.g., "Act 1 uses warm tones that shift cool during the crisis")
4. Suggest improvements for color consistency, contrast, mood enhancement, and visual pacing
5. Map the brightness/warmth/saturation curves to emotional arc
6. Note the overall palette characteristics and any color symbolism`,
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return NextResponse.json(
      { error: "AI did not return structured analysis" },
      { status: 500 }
    );
  }

  const analysis = toolUse.input as ColorAnalysisResult;

  return NextResponse.json(analysis);
  } catch (error: unknown) {
    logger.error("POST /api/color-script/analyze error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to analyze color script";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
