/**
 * Netlify Background Function for script doctor analysis.
 * Runs up to 15 minutes — avoids the 10-26s serverless timeout.
 * The "-background" suffix tells Netlify to run this as a background function.
 */
import { neon } from "@neondatabase/serverless";
import Anthropic from "@anthropic-ai/sdk";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HandlerEvent = { body: string | null; [key: string]: any };

/* ── Tool definition (must match claude-script-doctor.ts exactly) ── */
const SCRIPT_ANALYSIS_TOOL: Anthropic.Tool = {
  name: "script_analysis",
  description: "Provide a comprehensive script analysis with scores, structural breakdown, pacing assessment, character arcs, dialogue quality, themes, and issues.",
  input_schema: {
    type: "object" as const,
    required: ["overallScore", "logline", "synopsis", "structure", "pacing", "characters", "dialogue", "themes", "issues", "moodAndColor"],
    properties: {
      overallScore: { type: "number", description: "Overall screenplay quality score from 0-100" },
      logline: { type: "string", description: "A concise one-sentence logline for the screenplay" },
      synopsis: { type: "string", description: "A 2-4 sentence synopsis of the story" },
      structure: {
        type: "object",
        required: ["score", "actBreaks", "notes"],
        properties: {
          score: { type: "number", description: "Structure score from 0-100" },
          actBreaks: {
            type: "array",
            items: {
              type: "object",
              required: ["act", "startsAtScene", "endsAtScene", "assessment"],
              properties: {
                act: { type: "number" },
                startsAtScene: { type: "number" },
                endsAtScene: { type: "number" },
                assessment: { type: "string" },
              },
            },
          },
          incitingIncident: { type: "object", properties: { sceneId: { type: "number" }, assessment: { type: "string" } } },
          midpoint: { type: "object", properties: { sceneId: { type: "number" }, assessment: { type: "string" } } },
          climax: { type: "object", properties: { sceneId: { type: "number" }, assessment: { type: "string" } } },
          resolution: { type: "object", properties: { sceneId: { type: "number" }, assessment: { type: "string" } } },
          notes: { type: "string" },
        },
      },
      pacing: {
        type: "object",
        required: ["score", "slowSections", "rushedSections", "tensionCurve", "notes"],
        properties: {
          score: { type: "number", description: "Pacing score from 0-100" },
          slowSections: { type: "array", items: { type: "object", required: ["fromScene", "toScene", "reason"], properties: { fromScene: { type: "number" }, toScene: { type: "number" }, reason: { type: "string" } } } },
          rushedSections: { type: "array", items: { type: "object", required: ["fromScene", "toScene", "reason"], properties: { fromScene: { type: "number" }, toScene: { type: "number" }, reason: { type: "string" } } } },
          tensionCurve: { type: "array", description: "Tension level (0-100) for each scene", items: { type: "object", required: ["sceneNumber", "tension"], properties: { sceneNumber: { type: "number" }, tension: { type: "number" } } } },
          notes: { type: "string" },
        },
      },
      characters: {
        type: "array",
        description: "Analysis of each major character",
        items: {
          type: "object",
          required: ["name", "arcScore", "hasArc", "development", "strengths", "weaknesses"],
          properties: {
            name: { type: "string" },
            arcScore: { type: "number", description: "Character arc quality score 0-100" },
            hasArc: { type: "boolean" },
            introduction: { type: "object", properties: { sceneId: { type: "number" }, effective: { type: "boolean" }, notes: { type: "string" } } },
            development: { type: "string" },
            strengths: { type: "array", items: { type: "string" } },
            weaknesses: { type: "array", items: { type: "string" } },
          },
        },
      },
      dialogue: {
        type: "object",
        required: ["score", "voiceDistinctness", "onTheNose", "highlights", "notes"],
        properties: {
          score: { type: "number", description: "Dialogue quality score 0-100" },
          voiceDistinctness: { type: "number", description: "How distinct character voices are, 0-100" },
          onTheNose: { type: "array", items: { type: "object", required: ["dialogueId", "sceneId", "character", "line", "note"], properties: { dialogueId: { type: "number" }, sceneId: { type: "number" }, character: { type: "string" }, line: { type: "string" }, note: { type: "string" } } } },
          highlights: { type: "array", items: { type: "object", required: ["dialogueId", "character", "line", "note"], properties: { dialogueId: { type: "number" }, character: { type: "string" }, line: { type: "string" }, note: { type: "string" } } } },
          notes: { type: "string" },
        },
      },
      themes: {
        type: "object",
        required: ["identified", "notes"],
        properties: {
          identified: { type: "array", items: { type: "object", required: ["theme", "strength", "scenes"], properties: { theme: { type: "string" }, strength: { type: "string", enum: ["strong", "moderate", "subtle"] }, scenes: { type: "array", items: { type: "number" } } } } },
          notes: { type: "string" },
        },
      },
      issues: {
        type: "array",
        description: "Specific issues found in the screenplay",
        items: {
          type: "object",
          required: ["category", "severity", "title", "description", "sceneIds", "characterNames", "recommendation"],
          properties: {
            category: { type: "string", enum: ["structure", "pacing", "character", "dialogue", "continuity", "theme", "logic", "tone"] },
            severity: { type: "string", enum: ["critical", "major", "minor", "suggestion"] },
            title: { type: "string" },
            description: { type: "string" },
            sceneIds: { type: "array", items: { type: "number" } },
            characterNames: { type: "array", items: { type: "string" } },
            recommendation: { type: "string" },
          },
        },
      },
      moodAndColor: {
        type: "object",
        description: "Per-scene mood and color palette analysis",
        required: ["episodeAnchorMood", "scenes"],
        properties: {
          episodeAnchorMood: { type: "string", description: "Dominant emotional mood for the entire screenplay" },
          scenes: {
            type: "array",
            items: {
              type: "object",
              required: ["sceneNumber", "dominantMood", "recommendedBrightnessPercent", "colorPalette", "moodNotes"],
              properties: {
                sceneNumber: { type: "number" },
                dominantMood: { type: "string" },
                recommendedBrightnessPercent: { type: "number" },
                colorPalette: { type: "array", items: { type: "string" } },
                moodNotes: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
};

// Universal directing rules applied to ALL productions
const UNIVERSAL_DIRECTING_RULES = `
DIALOGUE SHOT DISCIPLINE (apply to ALL productions):
- When a character SPEAKS, the shot should frame ONLY the speaker's face. Use close-ups or over-the-shoulder shots where non-speaking characters are seen from behind.
- NEVER plan a dialogue moment as a wide two-shot or group shot with multiple visible faces — this creates visual confusion about who is speaking.
- Reaction shots should be separate cuts showing just the listener.
- Two-shots and group shots are for non-dialogue moments only.
If the screenplay has dialogue exchanges in locations where isolating the speaker would be awkward, suggest direction notes for camera placement.
`;

// Production style prompts — duplicated from src/lib/production-style.ts
const PRODUCTION_STYLE_PROMPTS: Record<string, string> = {
  childrens_animation: `
PRODUCTION STYLE: CHILDREN'S ANIMATION (ages 2-8)
Apply these rules to ALL analysis:
- Pacing should follow kids TV standards: scenes 30-90s, fast transitions, energy spikes every 2-3 min
- Dialogue should be short (5-10 words/line), characters say feelings directly, no sarcasm/irony
- Story structure: clear A-plot, problem in first 30s, age-appropriate stakes, lesson embedded naturally
- Characters need distinct voice patterns and catchphrases
- Repetition and callbacks are strengths, not weaknesses
- Happy/hopeful endings required
- DIALOGUE FRAMING: When a character speaks, only their face should be on screen. Other characters seen from behind or out of frame. One face, one voice — kids need clarity about who is talking.`,
  documentary: `
PRODUCTION STYLE: DOCUMENTARY
- Longer pacing OK, interview/B-roll rhythm matters
- Narration quality critical, thesis-evidence-conclusion arcs`,
  commercial: `
PRODUCTION STYLE: COMMERCIAL
- Every second counts, hook in first 2s, strong CTA`,
  music_video: `
PRODUCTION STYLE: MUSIC VIDEO
- Beat-driven cuts, visual storytelling over dialogue`,
};

function getSystemPrompt(analysisType: string, customPrompt?: string, productionStyle?: string | null): string {
  const base = `You are an expert screenplay analyst and script doctor. Analyze the screenplay thoroughly and provide actionable feedback.`;
  const stylePrompt = UNIVERSAL_DIRECTING_RULES + ((productionStyle && PRODUCTION_STYLE_PROMPTS[productionStyle]) || "");
  const prompts: Record<string, string> = {
    full: `${base} Perform a comprehensive analysis covering structure, characters, dialogue, pacing, and themes.${stylePrompt}`,
    structure: `${base} Focus specifically on story structure, act breaks, scene transitions, and narrative flow.${stylePrompt}`,
    characters: `${base} Focus on character development, arcs, motivations, and relationships.${stylePrompt}`,
    dialogue: `${base} Focus on dialogue quality, voice distinctiveness, subtext, and authenticity.${stylePrompt}`,
    pacing: `${base} Focus on pacing, scene length, tension build-up, and rhythm.${stylePrompt}`,
    custom: `${base} ${customPrompt || "Analyze the screenplay."}${stylePrompt}`,
  };
  return prompts[analysisType] || prompts.full;
}

async function handler(event: HandlerEvent) {
  console.log("[script-doctor] Function invoked");

  const dbUrl = process.env.NETLIFY_DATABASE_URL;
  if (!dbUrl) {
    console.error("[script-doctor] NETLIFY_DATABASE_URL not set");
    return { statusCode: 500, body: "DB URL not configured" };
  }

  const sql = neon(dbUrl);

  let analysisId: number;
  let projectId: number;
  let analysisType: string;
  let customPrompt: string | undefined;

  try {
    const body = JSON.parse(event.body || "{}");
    analysisId = Number(body.analysisId);
    projectId = Number(body.projectId);
    analysisType = body.analysisType || "full";
    customPrompt = body.customPrompt;

    if (!analysisId || !projectId) {
      console.error("[script-doctor] Missing required params");
      return { statusCode: 400, body: "Missing params" };
    }
  } catch {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  console.log(`[script-doctor] Starting analysis ${analysisId} for project ${projectId}, type: ${analysisType}`);

  try {
    // Update status
    await sql`UPDATE script_analyses SET status = 'processing' WHERE id = ${analysisId}`;

    // Load scenes with dialogues and directions
    const scenes = await sql`SELECT * FROM scenes WHERE project_id = ${projectId} ORDER BY sort_order ASC`;
    if (scenes.length === 0) {
      await sql`UPDATE script_analyses SET status = 'failed', error = 'No scenes found' WHERE id = ${analysisId}`;
      return { statusCode: 400, body: "No scenes" };
    }

    let screenplayText = "";
    for (const scene of scenes) {
      const dialogues = await sql`SELECT * FROM dialogues WHERE scene_id = ${scene.id} ORDER BY sort_order ASC`;
      const directions = await sql`SELECT * FROM directions WHERE scene_id = ${scene.id} ORDER BY sort_order ASC`;

      screenplayText += `\n--- SCENE ${scene.scene_number}: ${scene.heading} ---\n`;
      if (scene.location) screenplayText += `Location: ${scene.location}\n`;
      if (scene.time_of_day) screenplayText += `Time: ${scene.time_of_day}\n`;

      const elements = ([
        ...dialogues.map((d: Record<string, unknown>) => ({ ...d, _kind: "dialogue" as const })),
        ...directions.map((d: Record<string, unknown>) => ({ ...d, _kind: "direction" as const })),
      ] as Array<Record<string, unknown> & { _kind: string }>)
        .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));

      for (const el of elements) {
        if (el._kind === "dialogue") {
          screenplayText += `  ${el.character}${el.parenthetical ? ` (${el.parenthetical})` : ""}: ${el.line}\n`;
        } else {
          screenplayText += `  [${String(el.type ?? "").toUpperCase()}] ${el.content}\n`;
        }
      }
    }

    const characters = await sql`SELECT * FROM characters WHERE project_id = ${projectId}`;
    if (characters.length > 0) {
      screenplayText += `\n--- CHARACTERS ---\n`;
      for (const c of characters) {
        screenplayText += `${c.name}: ${c.description || "No description"}\n`;
      }
    }

    // Load project production style
    const projectRows = await sql`SELECT production_style FROM projects WHERE id = ${projectId}`;
    const productionStyle = projectRows[0]?.production_style as string | null;

    // Get API key
    const settingsRows = await sql`SELECT value FROM settings WHERE key = 'anthropic_api_key'`;
    const apiKey = (settingsRows[0]?.value as string) || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      await sql`UPDATE script_analyses SET status = 'failed', error = 'Anthropic API key not configured' WHERE id = ${analysisId}`;
      return { statusCode: 500, body: "No API key" };
    }

    // Call Claude
    console.log(`[script-doctor] Calling Claude for analysis ${analysisId}...`);
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 16000,
      tool_choice: { type: "tool", name: "script_analysis" },
      tools: [SCRIPT_ANALYSIS_TOOL],
      system: getSystemPrompt(analysisType, customPrompt, productionStyle),
      messages: [
        { role: "user", content: `Analyze this screenplay:\n\n${screenplayText}` },
      ],
    });

    console.log(`[script-doctor] Claude responded for analysis ${analysisId}`);

    const toolUse = message.content.find((block) => block.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error("Claude did not return structured analysis");
    }

    const result = toolUse.input as Record<string, unknown>;

    // Save result
    await sql`UPDATE script_analyses SET status = 'completed', result = ${JSON.stringify(result)}, token_count = ${message.usage?.input_tokens || 0} WHERE id = ${analysisId}`;
    console.log(`[script-doctor] Saved analysis result for ${analysisId}`);

    // Insert issues
    const issues = (result.issues || []) as Array<Record<string, unknown>>;
    for (let i = 0; i < issues.length; i++) {
      const issue = issues[i];
      await sql`
        INSERT INTO script_issues (
          analysis_id, project_id, category, severity, title, description,
          scene_ids, character_names, recommendation, is_resolved, sort_order
        ) VALUES (
          ${analysisId}, ${projectId}, ${issue.category as string}, ${issue.severity as string},
          ${issue.title as string}, ${issue.description as string},
          ${JSON.stringify(issue.sceneIds || [])}, ${JSON.stringify(issue.characterNames || [])},
          ${issue.recommendation as string}, 0, ${i}
        )
      `;
    }

    console.log(`[script-doctor] Completed analysis ${analysisId} — ${issues.length} issues found`);
    return { statusCode: 200, body: "OK" };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Background worker failed";
    console.error(`[script-doctor] Error for analysis ${analysisId}: ${msg}`);

    try {
      await sql`UPDATE script_analyses SET status = 'failed', error = ${msg} WHERE id = ${analysisId}`;
    } catch { /* best effort */ }

    return { statusCode: 500, body: msg };
  }
}

export { handler };
