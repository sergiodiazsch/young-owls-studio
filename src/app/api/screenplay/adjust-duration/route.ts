import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSetting, getScenesByProject, getProject } from "@/lib/db/queries";
import { db, ensureSchema } from "@/lib/db";
import { dialogues, directions, scenes as scenesTable } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { getProductionStylePrompt } from "@/lib/production-style";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/* ── Per-scene adjustment tool ── */
const SCENE_ADJUST_TOOL: Anthropic.Tool = {
  name: "scene_duration_adjustment",
  description: "Provide structured suggestions for adjusting a single scene's duration. Focus on dialogue trimming, action condensing, and beat restructuring within the scene.",
  input_schema: {
    type: "object" as const,
    required: ["currentDurationSeconds", "targetDurationSeconds", "options", "recommendation"],
    properties: {
      currentDurationSeconds: { type: "number", description: "Current estimated scene duration in seconds" },
      targetDurationSeconds: { type: "number", description: "Target scene duration in seconds" },
      options: {
        type: "array",
        description: "Adjustment options within this scene",
        items: {
          type: "object",
          required: ["id", "label", "strategy", "description", "impactSeconds", "riskLevel"],
          properties: {
            id: { type: "string" },
            label: { type: "string" },
            strategy: {
              type: "string",
              enum: ["trim_dialogue", "remove_beat", "condense_action", "merge_beats", "rewrite_concise", "remove_redundant_lines", "cut_direction"],
            },
            description: { type: "string", description: "What changes and why" },
            impactSeconds: { type: "number", description: "Seconds saved (negative) or added (positive)" },
            riskLevel: { type: "string", enum: ["low", "medium", "high"] },
            changes: {
              type: "array",
              items: {
                type: "object",
                required: ["type", "description"],
                properties: {
                  type: { type: "string", enum: ["trim", "remove", "rewrite", "merge", "condense"] },
                  character: { type: "string" },
                  originalLine: { type: "string" },
                  suggestedLine: { type: "string" },
                  description: { type: "string" },
                },
              },
            },
          },
        },
      },
      recommendation: { type: "string", description: "Recommended combination to reach target" },
    },
  },
};

/* ── Full-screenplay adjustment tool ── */
const ADJUST_TOOL: Anthropic.Tool = {
  name: "duration_adjustment",
  description:
    "Provide structured suggestions for adjusting a screenplay to fit a target duration. Include both scene-level and dialogue-level options.",
  input_schema: {
    type: "object" as const,
    required: ["currentDurationMinutes", "targetDurationMinutes", "sceneOptions", "dialogueOptions"],
    properties: {
      currentDurationMinutes: {
        type: "number",
        description: "Current estimated duration in minutes",
      },
      targetDurationMinutes: {
        type: "number",
        description: "Target duration in minutes",
      },
      sceneOptions: {
        type: "array",
        description: "Scene-level adjustment options (remove, merge, or add scenes)",
        items: {
          type: "object",
          required: ["id", "label", "action", "description", "impactMinutes", "affectedScenes", "riskLevel"],
          properties: {
            id: { type: "string", description: "Unique option ID (e.g. 'opt-1')" },
            label: { type: "string", description: "Short label for the option" },
            action: { type: "string", enum: ["remove", "merge", "split", "add"] },
            description: { type: "string", description: "Detailed explanation of what changes and why" },
            impactMinutes: { type: "number", description: "How many minutes this saves (negative) or adds (positive)" },
            affectedScenes: {
              type: "array",
              items: { type: "number" },
              description: "Scene numbers affected",
            },
            riskLevel: { type: "string", enum: ["low", "medium", "high"], description: "Risk to narrative quality" },
            preservesKeyMoments: { type: "boolean", description: "Whether key story moments are preserved" },
          },
        },
      },
      dialogueOptions: {
        type: "array",
        description: "Dialogue-level trimming options across scenes",
        items: {
          type: "object",
          required: ["id", "label", "description", "impactMinutes", "strategy"],
          properties: {
            id: { type: "string", description: "Unique option ID" },
            label: { type: "string", description: "Short label" },
            description: { type: "string", description: "What this trim strategy does" },
            impactMinutes: { type: "number", description: "Minutes saved (negative) or added (positive)" },
            strategy: {
              type: "string",
              enum: ["trim_all", "trim_specific_characters", "remove_redundant", "condense_exposition", "add_dialogue", "expand_scenes"],
            },
            details: {
              type: "array",
              description: "Per-scene changes",
              items: {
                type: "object",
                required: ["sceneNumber", "changes"],
                properties: {
                  sceneNumber: { type: "number" },
                  changes: {
                    type: "array",
                    items: {
                      type: "object",
                      required: ["type", "description"],
                      properties: {
                        type: { type: "string", enum: ["trim", "remove", "rewrite", "add", "expand"] },
                        character: { type: "string" },
                        originalLine: { type: "string" },
                        suggestedLine: { type: "string" },
                        description: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      recommendation: {
        type: "string",
        description: "The AI's recommended combination of options to reach the target duration while preserving quality",
      },
    },
  },
};

export async function POST(req: Request) {
  try {
    await ensureSchema();

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { projectId, targetDurationMinutes, targetDurationSeconds, sceneId } = body;
    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const pid = Number(projectId);
    if (isNaN(pid)) {
      return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });
    }

    const project = await getProject(pid);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const stylePrompt = getProductionStylePrompt(project.productionStyle);

    // Get API key
    const setting = await getSetting("anthropic_api_key");
    const apiKey = setting?.value || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Anthropic API key not configured" }, { status: 500 });
    const client = new Anthropic({ apiKey });

    // ── Per-scene mode ──
    if (sceneId) {
      const sid = Number(sceneId);
      const targetSec = Number(targetDurationSeconds);
      if (isNaN(sid) || isNaN(targetSec) || targetSec <= 0) {
        return NextResponse.json({ error: "sceneId and targetDurationSeconds are required for per-scene mode" }, { status: 400 });
      }

      const [scene] = await db.select().from(scenesTable).where(eq(scenesTable.id, sid));
      if (!scene) return NextResponse.json({ error: "Scene not found" }, { status: 404 });

      const sceneDialogues = await db.select().from(dialogues).where(eq(dialogues.sceneId, sid)).orderBy(asc(dialogues.sortOrder));
      const sceneDirections = await db.select().from(directions).where(eq(directions.sceneId, sid)).orderBy(asc(directions.sortOrder));

      const lineCount = sceneDialogues.length * 2 + sceneDirections.length;
      const estSeconds = Math.max(30, Math.round((lineCount / 55) * 60));

      let sceneText = `SCENE ${scene.sceneNumber}: ${scene.heading}\n`;
      sceneText += `Location: ${scene.location || "N/A"} | Time: ${scene.timeOfDay || "N/A"}\n`;
      sceneText += `Estimated duration: ~${estSeconds}s\n`;
      if (scene.synopsis) sceneText += `Synopsis: ${scene.synopsis}\n`;
      sceneText += "\n";

      const allElements = [
        ...sceneDialogues.map((d) => ({ ...d, _kind: "dialogue" as const })),
        ...sceneDirections.map((d) => ({ ...d, _kind: "direction" as const })),
      ].sort((a, b) => a.sortOrder - b.sortOrder);

      for (const el of allElements) {
        if (el._kind === "dialogue") {
          const d = el as (typeof sceneDialogues)[0];
          sceneText += `  ${d.character}${d.parenthetical ? ` (${d.parenthetical})` : ""}: ${d.line}\n`;
        } else {
          const d = el as (typeof sceneDirections)[0];
          sceneText += `  [${d.type.toUpperCase()}] ${d.content}\n`;
        }
      }

      const sceneDirection = targetSec < estSeconds ? "shorten" : "lengthen";

      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 3000,
        tool_choice: { type: "tool", name: "scene_duration_adjustment" },
        tools: [SCENE_ADJUST_TOOL],
        system: `You are an expert screenplay editor. Analyze this SINGLE SCENE and suggest practical options to ${sceneDirection} it from ~${estSeconds} seconds to ${targetSec} seconds.

Focus on WITHIN-SCENE adjustments only:
- Trim or expand dialogue lines
- Remove or add action beats
- Condense or expand stage directions
- Merge redundant beats
- Rewrite lines to be more concise or elaborate

IMPORTANT:
- Be specific — reference exact dialogue lines and directions
- Provide 3-4 options with different strategies
- Each option should have a clear impact in seconds
- Mark risk level honestly
- Preserve the scene's core dramatic purpose
- Be concise in descriptions — no lengthy explanations${stylePrompt}`,
        messages: [
          {
            role: "user",
            content: `${sceneDirection === "shorten" ? "Shorten" : "Lengthen"} this scene from ~${estSeconds}s to ${targetSec}s.\n\n${sceneText}`,
          },
        ],
      });

      const toolUse = response.content.find((block) => block.type === "tool_use");
      if (!toolUse || toolUse.type !== "tool_use") {
        throw new Error("Claude did not return structured suggestions");
      }

      return NextResponse.json({ ...toolUse.input as Record<string, unknown>, mode: "scene" });
    }

    // ── Full-screenplay mode ──
    const target = Number(targetDurationMinutes);
    if (isNaN(target) || target <= 0) {
      return NextResponse.json({ error: "targetDurationMinutes is required for full-screenplay mode" }, { status: 400 });
    }

    const scenes = await getScenesByProject(pid);
    if (!scenes || scenes.length === 0) {
      return NextResponse.json({ error: "No scenes found" }, { status: 400 });
    }

    let screenplayText = `SCREENPLAY: "${project.title}"\n\n`;
    let totalPageCount = 0;

    for (const scene of scenes) {
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

      const lineCount = sceneDialogues.length * 2 + sceneDirections.length;
      const estPages = Math.max(0.5, lineCount / 55);
      totalPageCount += estPages;

      screenplayText += `--- SCENE ${scene.sceneNumber}: ${scene.heading} ---\n`;
      screenplayText += `Location: ${scene.location || "N/A"} | Time: ${scene.timeOfDay || "N/A"}\n`;
      screenplayText += `Estimated duration: ~${Math.round(estPages * 60)}s (~${estPages.toFixed(1)} pages)\n`;
      if (scene.synopsis) screenplayText += `Synopsis: ${scene.synopsis}\n`;
      screenplayText += "\n";

      const allElements = [
        ...sceneDialogues.map((d) => ({ ...d, _kind: "dialogue" as const })),
        ...sceneDirections.map((d) => ({ ...d, _kind: "direction" as const })),
      ].sort((a, b) => a.sortOrder - b.sortOrder);

      for (const el of allElements) {
        if (el._kind === "dialogue") {
          const d = el as (typeof sceneDialogues)[0];
          screenplayText += `  ${d.character}${d.parenthetical ? ` (${d.parenthetical})` : ""}: ${d.line}\n`;
        } else {
          const d = el as (typeof sceneDirections)[0];
          screenplayText += `  [${d.type.toUpperCase()}] ${d.content}\n`;
        }
      }
      screenplayText += "\n";
    }

    const currentDuration = Math.round(totalPageCount);
    const direction = target < currentDuration ? "shorten" : "lengthen";

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      tool_choice: { type: "tool", name: "duration_adjustment" },
      tools: [ADJUST_TOOL],
      system: `You are an expert screenplay editor. Analyze the screenplay and suggest practical options to ${direction} it from ~${currentDuration} minutes to ${target} minutes.

For scene-level options: suggest removing, merging, or adding specific scenes. Consider narrative importance.
For dialogue-level options: suggest trimming or expanding dialogue across scenes. Be specific about which lines to change.

IMPORTANT:
- 1 screenplay page ≈ 1 minute of screen time
- Provide at least 2 scene-level options and 2 dialogue-level options
- Each option should have a clear impact in minutes
- Mark risk level honestly — removing a climax scene is HIGH risk
- Be specific in your recommendations${stylePrompt}`,
      messages: [
        {
          role: "user",
          content: `${direction === "shorten" ? "Shorten" : "Lengthen"} this screenplay from ~${currentDuration} minutes to ${target} minutes.\n\n${screenplayText}`,
        },
      ],
    });

    const toolUse = response.content.find((block) => block.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error("Claude did not return structured suggestions");
    }

    return NextResponse.json({ ...toolUse.input as Record<string, unknown>, mode: "screenplay" });
  } catch (error: unknown) {
    logger.error("POST /api/screenplay/adjust-duration error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to analyze duration" },
      { status: 500 }
    );
  }
}
