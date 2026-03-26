/**
 * Netlify Background Function for breakdown generation.
 * Runs up to 15 minutes — avoids the 10-26s serverless timeout.
 * The "-background" suffix tells Netlify to run this as a background function.
 */
import { neon } from "@neondatabase/serverless";
import Anthropic from "@anthropic-ai/sdk";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HandlerEvent = { body: string | null; [key: string]: any };

/* ── Tool definition (mirrors the one in the API route) ── */

const BREAKDOWN_TOOL: Anthropic.Tool = {
  name: "scene_breakdown",
  description:
    "Create a complete AI video production breakdown for a screenplay scene.",
  input_schema: {
    type: "object" as const,
    required: ["metadata", "shots", "images", "dialogueLines", "audioDesign"],
    properties: {
      metadata: {
        type: "object",
        required: [
          "totalImages",
          "totalVideoClips",
          "totalDialogueLines",
          "estimatedComplexity",
          "sceneMood",
          "artDirection",
          "estimatedDurationSeconds",
        ],
        properties: {
          totalImages: { type: "number" },
          totalVideoClips: { type: "number" },
          totalDialogueLines: { type: "number" },
          estimatedComplexity: {
            type: "string",
            enum: ["simple", "moderate", "complex"],
          },
          sceneMood: { type: "string" },
          artDirection: { type: "string" },
          estimatedDurationSeconds: { type: "number" },
        },
      },
      shots: {
        type: "array",
        items: {
          type: "object",
          required: ["shotNumber", "shotType", "description", "camera", "durationSeconds", "purpose"],
          properties: {
            shotNumber: { type: "number" },
            shotType: {
              type: "string",
              enum: [
                "establishing_wide", "wide", "medium", "medium_close",
                "close_up", "extreme_close_up", "over_shoulder", "two_shot",
                "insert_detail", "transition", "artistic_breathing", "pov",
              ],
            },
            description: { type: "string" },
            camera: { type: "string" },
            durationSeconds: { type: "number" },
            purpose: {
              type: "string",
              enum: ["establish", "action", "dialogue", "reaction", "atmosphere", "transition", "detail"],
            },
            character: { type: "string" },
            dialogueLineIndex: { type: "number" },
            imageIds: { type: "array", items: { type: "string" } },
            notes: { type: "string" },
          },
        },
      },
      images: {
        type: "array",
        items: {
          type: "object",
          required: ["imageId", "imageType", "subject", "promptSuggestion"],
          properties: {
            imageId: { type: "string" },
            imageType: {
              type: "string",
              enum: [
                "environment_wide", "environment_detail", "character_full",
                "character_medium", "character_closeup", "character_in_environment",
                "prop_detail", "transition_art", "establishing",
              ],
            },
            subject: { type: "string" },
            promptSuggestion: { type: "string" },
            usedInShots: { type: "array", items: { type: "number" } },
            notes: { type: "string" },
          },
        },
      },
      dialogueLines: {
        type: "array",
        items: {
          type: "object",
          required: ["index", "character", "line", "emotion"],
          properties: {
            index: { type: "number" },
            character: { type: "string" },
            line: { type: "string" },
            emotion: { type: "string" },
            parenthetical: { type: "string" },
          },
        },
      },
      audioDesign: {
        type: "array",
        items: {
          type: "object",
          required: ["audioType", "description"],
          properties: {
            audioType: { type: "string", enum: ["ambience", "sfx", "music", "foley"] },
            description: { type: "string" },
            timing: { type: "string" },
          },
        },
      },
    },
  },
};

const BASE_SYSTEM_PROMPT = `You are an expert AI Video Production Director. You specialize in planning the production of animated/AI-generated video content from screenplays.

Your job: analyze a screenplay scene and create a complete production breakdown for AI video generation. Think about this like a real director planning their shot list, but instead of a physical set and actors, every visual element will be AI-generated images that are then animated into video clips.

KEY PRINCIPLES:
1. SHOT PLANNING: Plan a cinematic shot sequence. Start with an establishing shot. Use transitions between beats. Include "breathing room" — artistic/atmospheric shots where the image lingers without dialogue. During dialogue, alternate between close-ups of the speaker and reaction shots of the listener.

2. IMAGE GENERATION: For each unique visual setup, we need an AI-generated image. Think about:
   - The ENVIRONMENT needs wide shots (for establishing) and detail angles
   - Each CHARACTER needs images at different framings (full body, medium, close-up) matching the shots where they appear
   - CHARACTER-IN-ENVIRONMENT composites where we see the character in the location
   - DETAIL shots of important props or elements mentioned in the script
   - TRANSITION images for scene transitions

3. PROMPTS: Write actual image generation prompts that are detailed and cinematic. Include composition, lighting, color palette, camera angle, lens type, and mood. Be consistent with the art direction across all prompts.

4. VIDEO ASSEMBLY: Each image becomes a short video clip (3-8 seconds typically). The camera movement description helps the video AI know what animation to apply (pan, zoom, static, etc.).

5. AUDIO: Identify all dialogue lines, ambient sounds, sound effects, and music cues needed.

Be thorough but practical. A typical 1-page scene might need 8-15 images and 10-20 video clips.`;

// Production style prompts — duplicated from src/lib/production-style.ts because
// Netlify background functions can't import from the Next.js src directory.
const PRODUCTION_STYLE_PROMPTS: Record<string, string> = {
  childrens_animation: `
PRODUCTION STYLE: CHILDREN'S ANIMATION (ages 2-8)
Apply these rules to ALL breakdown decisions:

SHOT PLANNING & FRAMING:
- Favor WIDE and MEDIUM shots — kids need to see the full body and environment
- Close-ups should be BRIEF and used for emotional beats only
- Keep camera movements SIMPLE: gentle pans, slow zooms. No handheld shake.
- Shot duration: 3-5 seconds per shot. Never hold longer than 6 seconds.
- Establishing shots are essential — always show WHERE we are before WHAT happens
- Character eyelines should be clear — kids need to see who is talking to whom
- Bright, saturated color palettes. High contrast between characters and backgrounds.

PACING:
- Scenes should be SHORT: 30-90 seconds max
- Fast scene transitions — cut, don't fade. Fun transitions (wipes) are OK.
- Every 2-3 minutes needs a new energy spike
- Shot duration: 3-5 seconds. Never hold longer than 6 seconds.

AUDIO:
- Music should be prominent — guides emotional state for pre-literate viewers
- Sound effects should be exaggerated and fun (cartoon physics)
- Ambient sound should be MINIMAL
- Consider singalong or musical moments`,
  documentary: `
PRODUCTION STYLE: DOCUMENTARY
- Favor interview setups + B-roll alternation
- Longer shot durations OK (5-15s for atmospheric B-roll)
- Understated music, never competing with narration`,
  commercial: `
PRODUCTION STYLE: COMMERCIAL
- Quick cuts (1-3 seconds per shot)
- Hook in the first 2 seconds
- Product/message must be clear`,
  music_video: `
PRODUCTION STYLE: MUSIC VIDEO
- Cuts aligned with beat/rhythm
- Visual storytelling over dialogue
- Creative, stylized transitions`,
};

function getSystemPrompt(productionStyle?: string | null): string {
  const stylePrompt = (productionStyle && PRODUCTION_STYLE_PROMPTS[productionStyle]) || "";
  return BASE_SYSTEM_PROMPT + stylePrompt;
}

/* ── Handler ── */

async function handler(event: HandlerEvent) {
  console.log("[breakdown-worker] Function invoked!", JSON.stringify({ body: event.body?.slice(0, 200), hasDbUrl: !!process.env.NETLIFY_DATABASE_URL }));

  const dbUrl = process.env.NETLIFY_DATABASE_URL;
  if (!dbUrl) {
    console.error("[breakdown-worker] NETLIFY_DATABASE_URL not set");
    return { statusCode: 500, body: "DB URL not configured" };
  }

  const sql = neon(dbUrl);

  let sceneId: number;
  let projectId: number;
  let breakdownId: number;

  try {
    const body = JSON.parse(event.body || "{}");
    sceneId = Number(body.sceneId);
    projectId = Number(body.projectId);
    breakdownId = Number(body.breakdownId);

    if (!sceneId || !projectId || !breakdownId) {
      console.error("[breakdown-worker] Missing required params");
      return { statusCode: 400, body: "Missing params" };
    }
  } catch {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  console.log(`[breakdown-worker] Starting generation for scene ${sceneId}, breakdown ${breakdownId}`);

  try {
    // Load scene data
    const sceneRows = await sql`SELECT * FROM scenes WHERE id = ${sceneId}`;
    if (sceneRows.length === 0) {
      await sql`UPDATE scene_breakdowns SET status = 'failed', notes = 'Scene not found', updated_at = ${new Date().toISOString()} WHERE id = ${breakdownId}`;
      return { statusCode: 404, body: "Scene not found" };
    }
    const scene = sceneRows[0];

    // Load project to get production style
    const projectRows = await sql`SELECT production_style FROM projects WHERE id = ${projectId}`;
    const productionStyle = projectRows[0]?.production_style as string | null;

    const dialogueRows = await sql`SELECT * FROM dialogues WHERE scene_id = ${sceneId} ORDER BY sort_order ASC`;
    const directionRows = await sql`SELECT * FROM directions WHERE scene_id = ${sceneId} ORDER BY sort_order ASC`;

    // Build scene text — SQL rows are Record<string, unknown>
    const allElements = ([
      ...dialogueRows.map((d) => ({ ...d, _kind: "dialogue" as const })),
      ...directionRows.map((d) => ({ ...d, _kind: "direction" as const })),
    ] as Array<Record<string, unknown> & { _kind: string }>)
      .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));

    let sceneText = `SCENE HEADING: ${scene.heading}\n`;
    if (scene.location) sceneText += `LOCATION: ${scene.location}\n`;
    if (scene.time_of_day) sceneText += `TIME OF DAY: ${scene.time_of_day}\n`;
    if (scene.synopsis) sceneText += `SYNOPSIS: ${scene.synopsis}\n`;
    sceneText += "\nSCRIPT CONTENT:\n";

    for (const el of allElements) {
      if (el._kind === "dialogue") {
        sceneText += `\n${el.character}${el.parenthetical ? ` ${el.parenthetical}` : ""}\n${el.line}\n`;
      } else {
        sceneText += `\n[${String(el.type ?? "").toUpperCase()}] ${el.content}\n`;
      }
    }

    // Get API key
    const settingsRows = await sql`SELECT value FROM settings WHERE key = 'anthropic_api_key'`;
    const apiKey = settingsRows[0]?.value || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      await sql`UPDATE scene_breakdowns SET status = 'failed', notes = 'Anthropic API key not configured', updated_at = ${new Date().toISOString()} WHERE id = ${breakdownId}`;
      return { statusCode: 500, body: "No API key" };
    }

    // Call Claude
    console.log(`[breakdown-worker] Calling Claude for scene ${sceneId}...`);
    const client = new Anthropic({ apiKey: apiKey as string });

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 12000,
      tool_choice: { type: "tool", name: "scene_breakdown" },
      tools: [BREAKDOWN_TOOL],
      system: getSystemPrompt(productionStyle),
      messages: [
        {
          role: "user",
          content: `Create a complete AI video production breakdown for this scene:\n\n${sceneText}`,
        },
      ],
    });

    console.log(`[breakdown-worker] Claude responded for scene ${sceneId}`);

    const toolUse = message.content.find((block) => block.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error("Claude did not return structured breakdown data");
    }

    const result = toolUse.input as Record<string, unknown>;

    // Compute metadata
    const metadata = result.metadata as Record<string, unknown> | undefined;
    const estimatedDurationSec = (metadata?.estimatedDurationSeconds as number) || 60;
    const totalImages = (metadata?.totalImages as number) || 0;
    const pageCount = Math.round((estimatedDurationSec / 60) * 10) / 10;
    const complexityMultiplier =
      metadata?.estimatedComplexity === "complex" ? 1.5 :
      metadata?.estimatedComplexity === "moderate" ? 1.0 : 0.5;
    const estimatedHours = Math.round((totalImages * 0.25 * complexityMultiplier) * 10) / 10;

    // Save breakdown
    console.log(`[breakdown-worker] Saving breakdown ${breakdownId} — Claude returned tool_use data`);
    await sql`
      UPDATE scene_breakdowns SET
        status = 'completed',
        page_count = ${pageCount},
        day_or_night = ${scene.time_of_day || null},
        int_or_ext = ${scene.heading_type || null},
        estimated_shoot_hours = ${estimatedHours},
        notes = ${JSON.stringify(result)},
        updated_at = ${new Date().toISOString()}
      WHERE id = ${breakdownId}
    `;

    // Delete old elements and insert new ones
    await sql`DELETE FROM breakdown_elements WHERE breakdown_id = ${breakdownId}`;

    let sortIdx = 0;

    const images = (result.images || []) as Array<Record<string, unknown>>;
    for (const img of images) {
      const desc = `${img.promptSuggestion || ""}${img.notes ? `\n\nNotes: ${img.notes}` : ""}`;
      await sql`
        INSERT INTO breakdown_elements (breakdown_id, category, name, description, quantity, is_custom, sort_order)
        VALUES (${breakdownId}, ${(img.imageType as string) || "establishing"}, ${(img.subject as string) || "Image"}, ${desc}, ${(img.usedInShots as number[])?.length || 1}, 0, ${sortIdx++})
      `;
    }

    const dialogueLines = (result.dialogueLines || []) as Array<Record<string, unknown>>;
    for (const dl of dialogueLines) {
      const name = `${dl.character}: "${dl.line}"`;
      const desc = `Emotion: ${dl.emotion}${dl.parenthetical ? ` | ${dl.parenthetical}` : ""}`;
      await sql`
        INSERT INTO breakdown_elements (breakdown_id, category, name, description, quantity, is_custom, sort_order)
        VALUES (${breakdownId}, 'dialogue', ${name}, ${desc}, 1, 0, ${sortIdx++})
      `;
    }

    const audioDesign = (result.audioDesign || []) as Array<Record<string, unknown>>;
    for (const ad of audioDesign) {
      await sql`
        INSERT INTO breakdown_elements (breakdown_id, category, name, description, quantity, is_custom, sort_order)
        VALUES (${breakdownId}, ${"audio_" + ad.audioType}, ${(ad.description as string) || "Audio"}, ${(ad.timing as string) || null}, 1, 0, ${sortIdx++})
      `;
    }

    console.log(`[breakdown-worker] Completed scene ${sceneId} — ${images.length} images, ${dialogueLines.length} dialogue lines`);
    return { statusCode: 200, body: "OK" };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Background worker failed";
    console.error(`[breakdown-worker] Error for scene ${sceneId}: ${message}`);

    try {
      await sql`
        UPDATE scene_breakdowns SET
          status = 'failed',
          notes = ${message},
          updated_at = ${new Date().toISOString()}
        WHERE id = ${breakdownId}
      `;
    } catch { /* best effort */ }

    return { statusCode: 500, body: message };
  }
}

export { handler };
