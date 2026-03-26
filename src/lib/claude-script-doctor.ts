import Anthropic from "@anthropic-ai/sdk";
import { getSetting } from "./db/queries";
import type { AnalysisResult, Scene, Dialogue, Direction, Character } from "./types";
import { getProductionStylePrompt } from "./production-style";

async function getAnthropicClient(): Promise<Anthropic> {
  const setting = await getSetting("anthropic_api_key");
  const apiKey = setting?.value || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Anthropic API key not configured. Go to Settings or set ANTHROPIC_API_KEY env var.");
  return new Anthropic({ apiKey });
}

// ── Script Analysis Tool Schema ──

const SCRIPT_ANALYSIS_TOOL: Anthropic.Tool = {
  name: "script_analysis",
  description:
    "Provide a comprehensive script analysis with scores, structural breakdown, pacing assessment, character arcs, dialogue quality, themes, and issues.",
  input_schema: {
    type: "object" as const,
    required: [
      "overallScore",
      "logline",
      "synopsis",
      "structure",
      "pacing",
      "characters",
      "dialogue",
      "themes",
      "issues",
      "moodAndColor",
    ],
    properties: {
      overallScore: {
        type: "number",
        description: "Overall screenplay quality score from 0-100",
      },
      logline: {
        type: "string",
        description: "A concise one-sentence logline for the screenplay",
      },
      synopsis: {
        type: "string",
        description: "A 2-4 sentence synopsis of the story",
      },
      structure: {
        type: "object",
        required: ["score", "actBreaks", "notes"],
        properties: {
          score: {
            type: "number",
            description: "Structure score from 0-100",
          },
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
          incitingIncident: {
            type: "object",
            properties: {
              sceneId: { type: "number" },
              assessment: { type: "string" },
            },
          },
          midpoint: {
            type: "object",
            properties: {
              sceneId: { type: "number" },
              assessment: { type: "string" },
            },
          },
          climax: {
            type: "object",
            properties: {
              sceneId: { type: "number" },
              assessment: { type: "string" },
            },
          },
          resolution: {
            type: "object",
            properties: {
              sceneId: { type: "number" },
              assessment: { type: "string" },
            },
          },
          notes: { type: "string" },
        },
      },
      pacing: {
        type: "object",
        required: ["score", "slowSections", "rushedSections", "tensionCurve", "notes"],
        properties: {
          score: {
            type: "number",
            description: "Pacing score from 0-100",
          },
          slowSections: {
            type: "array",
            items: {
              type: "object",
              required: ["fromScene", "toScene", "reason"],
              properties: {
                fromScene: { type: "number" },
                toScene: { type: "number" },
                reason: { type: "string" },
              },
            },
          },
          rushedSections: {
            type: "array",
            items: {
              type: "object",
              required: ["fromScene", "toScene", "reason"],
              properties: {
                fromScene: { type: "number" },
                toScene: { type: "number" },
                reason: { type: "string" },
              },
            },
          },
          tensionCurve: {
            type: "array",
            description:
              "Tension level (0-100) for each scene to create a tension curve graph",
            items: {
              type: "object",
              required: ["sceneNumber", "tension"],
              properties: {
                sceneNumber: { type: "number" },
                tension: { type: "number" },
              },
            },
          },
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
            arcScore: {
              type: "number",
              description: "Character arc quality score 0-100",
            },
            hasArc: { type: "boolean" },
            introduction: {
              type: "object",
              properties: {
                sceneId: { type: "number" },
                effective: { type: "boolean" },
                notes: { type: "string" },
              },
            },
            development: { type: "string" },
            strengths: {
              type: "array",
              items: { type: "string" },
            },
            weaknesses: {
              type: "array",
              items: { type: "string" },
            },
          },
        },
      },
      dialogue: {
        type: "object",
        required: ["score", "voiceDistinctness", "onTheNose", "highlights", "notes"],
        properties: {
          score: {
            type: "number",
            description: "Dialogue quality score 0-100",
          },
          voiceDistinctness: {
            type: "number",
            description:
              "How distinct character voices are from each other, 0-100",
          },
          onTheNose: {
            type: "array",
            description: "Dialogue lines that are too on-the-nose / expository",
            items: {
              type: "object",
              required: ["dialogueId", "sceneId", "character", "line", "note"],
              properties: {
                dialogueId: { type: "number" },
                sceneId: { type: "number" },
                character: { type: "string" },
                line: { type: "string" },
                note: { type: "string" },
              },
            },
          },
          highlights: {
            type: "array",
            description: "Particularly strong dialogue moments",
            items: {
              type: "object",
              required: ["dialogueId", "character", "line", "note"],
              properties: {
                dialogueId: { type: "number" },
                character: { type: "string" },
                line: { type: "string" },
                note: { type: "string" },
              },
            },
          },
          notes: { type: "string" },
        },
      },
      themes: {
        type: "object",
        required: ["identified", "notes"],
        properties: {
          identified: {
            type: "array",
            items: {
              type: "object",
              required: ["theme", "strength", "scenes"],
              properties: {
                theme: { type: "string" },
                strength: {
                  type: "string",
                  enum: ["strong", "moderate", "subtle"],
                },
                scenes: {
                  type: "array",
                  items: { type: "number" },
                },
              },
            },
          },
          notes: { type: "string" },
        },
      },
      issues: {
        type: "array",
        description: "Specific issues found in the screenplay",
        items: {
          type: "object",
          required: [
            "category",
            "severity",
            "title",
            "description",
            "sceneIds",
            "characterNames",
            "recommendation",
          ],
          properties: {
            category: {
              type: "string",
              enum: [
                "structure",
                "pacing",
                "character",
                "dialogue",
                "continuity",
                "theme",
                "logic",
                "tone",
              ],
            },
            severity: {
              type: "string",
              enum: ["critical", "major", "minor", "suggestion"],
            },
            title: { type: "string" },
            description: { type: "string" },
            sceneIds: {
              type: "array",
              items: { type: "number" },
            },
            characterNames: {
              type: "array",
              items: { type: "string" },
            },
            recommendation: { type: "string" },
          },
        },
      },
      moodAndColor: {
        type: "object",
        description: "Per-scene mood and color palette analysis for visual development",
        required: ["episodeAnchorMood", "scenes"],
        properties: {
          episodeAnchorMood: {
            type: "string",
            description: "The dominant emotional mood for the entire episode/screenplay (e.g. hopeful, tense, melancholic)",
          },
          scenes: {
            type: "array",
            items: {
              type: "object",
              required: ["sceneNumber", "dominantMood", "recommendedBrightnessPercent", "colorPalette", "moodNotes"],
              properties: {
                sceneNumber: { type: "number" },
                dominantMood: {
                  type: "string",
                  description: "Primary emotional mood of this scene (e.g. joyful, tense, somber, chaotic)",
                },
                recommendedBrightnessPercent: {
                  type: "number",
                  description: "Recommended overall brightness for this scene (0-100, where 0 is very dark and 100 is very bright)",
                },
                colorPalette: {
                  type: "array",
                  description: "3 hex color codes representing the recommended color palette for this scene",
                  items: { type: "string" },
                },
                moodNotes: {
                  type: "string",
                  description: "Brief explanation of the mood and color choices",
                },
              },
            },
          },
        },
      },
    },
  },
};

// ── Build screenplay text representation ──

interface SceneWithElements extends Scene {
  dialogues?: Dialogue[];
  directions?: Direction[];
}

function buildScreenplayText(
  scenes: SceneWithElements[],
  characters: Character[]
): string {
  const parts: string[] = [];

  parts.push("=== CHARACTERS ===");
  for (const char of characters) {
    parts.push(
      `${char.name}${char.description ? ` - ${char.description}` : ""} (${char.dialogueCount} lines)`
    );
  }
  parts.push("");

  parts.push("=== SCREENPLAY ===");
  for (const scene of scenes) {
    parts.push(`\n--- Scene ${scene.sceneNumber}: ${scene.heading} ---`);
    if (scene.synopsis) {
      parts.push(`[Synopsis: ${scene.synopsis}]`);
    }

    // Merge dialogues and directions by sortOrder
    const elements: Array<{ sortOrder: number; text: string }> = [];

    if (scene.dialogues) {
      for (const d of scene.dialogues) {
        const paren = d.parenthetical ? ` ${d.parenthetical}` : "";
        elements.push({
          sortOrder: d.sortOrder,
          text: `  ${d.character}${paren}: "${d.line}" [dialogue_id:${d.id}, scene_id:${scene.id}]`,
        });
      }
    }

    if (scene.directions) {
      for (const dir of scene.directions) {
        elements.push({
          sortOrder: dir.sortOrder,
          text: `  [${dir.type.toUpperCase()}] ${dir.content}`,
        });
      }
    }

    elements.sort((a, b) => a.sortOrder - b.sortOrder);
    for (const el of elements) {
      parts.push(el.text);
    }
  }

  return parts.join("\n");
}

// ── Analysis type prompts ──

function getAnalysisPrompt(
  analysisType: string,
  customPrompt?: string,
  productionStyle?: string | null,
): string {
  const stylePrompt = getProductionStylePrompt(productionStyle);
  const base =
    "You are a professional script doctor and screenplay consultant with decades of experience in the film and television industry. Analyze the following screenplay thoroughly.";

  const moodColorInstruction = `

MOOD & COLOR: For every scene, determine the dominant emotional mood, recommend a brightness level (0-100%), and suggest a 3-color hex palette that evokes the scene's feeling. Also identify an overall "anchor mood" for the entire episode/screenplay. Think like a cinematographer and colorist — the palettes should reflect the emotional journey.`;

  switch (analysisType) {
    case "full":
      return `${base}

Provide a comprehensive analysis covering:
1. STRUCTURE - Three-act structure, inciting incident, midpoint, climax, resolution, act breaks
2. PACING - Tension curve, slow/rushed sections, rhythm between action and dialogue
3. CHARACTERS - Character arcs, introductions, development, strengths and weaknesses
4. DIALOGUE - Voice distinctness, on-the-nose dialogue, highlights, naturalism
5. THEMES - Identified themes, how well they are woven through the story
6. CONTINUITY - Plot holes, logic issues, timeline problems

Be specific. Reference exact scene numbers and dialogue IDs. Assign scores honestly - most scripts have room for improvement. Use the tension curve to map the emotional journey scene by scene.${moodColorInstruction}${stylePrompt}`;

    case "structure":
      return `${base}

Focus specifically on STRUCTURAL analysis:
- Three-act structure adherence and effectiveness
- Inciting incident placement and impact
- Midpoint reversal or complication
- Climax effectiveness
- Resolution satisfaction
- Act break identification
- Scene sequencing and necessity (are there scenes that don't serve the story?)
- Setup and payoff tracking

For areas outside structure (pacing, characters, dialogue, themes), provide basic assessments but focus your detailed analysis on structure. Still provide tension curve data and identify any issues.${moodColorInstruction}${stylePrompt}`;

    case "characters":
      return `${base}

Focus specifically on CHARACTER analysis:
- Each character's arc (or lack thereof)
- Character introductions - are they memorable and effective?
- Character motivation clarity
- Relationship dynamics
- Voice distinctness between characters
- Character contradictions or inconsistencies
- Supporting character utility and depth
- Protagonist likeability/relatability

For areas outside characters (structure, pacing, themes), provide basic assessments but focus your detailed analysis on character work. Still provide tension curve data and identify issues.${moodColorInstruction}${stylePrompt}`;

    case "dialogue":
      return `${base}

Focus specifically on DIALOGUE analysis:
- Voice distinctness - can you tell who is speaking without character names?
- On-the-nose dialogue (characters stating what they feel directly)
- Subtext quality
- Exposition handling
- Rhythm and flow
- Memorable lines
- Dialogue that feels unnatural or forced
- Character-specific speech patterns

For areas outside dialogue (structure, pacing, themes), provide basic assessments but focus your detailed analysis on dialogue quality. Still provide tension curve data and identify issues.${moodColorInstruction}${stylePrompt}`;

    case "pacing":
      return `${base}

Focus specifically on PACING analysis:
- Tension curve scene-by-scene (be precise with tension values 0-100)
- Sections that drag or feel slow
- Sections that feel rushed or underdeveloped
- Balance between action and dialogue scenes
- Scene length variation effectiveness
- Information delivery timing
- Cliffhangers and act-out moments
- Overall rhythm and momentum

For areas outside pacing (structure, characters, dialogue, themes), provide basic assessments but focus your detailed analysis on pacing. Still provide tension curve data and identify issues.${moodColorInstruction}${stylePrompt}`;

    case "custom":
      return `${base}

${customPrompt || "Provide a comprehensive analysis."}

In addition to addressing the above, still provide complete scores for structure, pacing, characters, and dialogue. Generate the tension curve data and identify specific issues.${moodColorInstruction}${stylePrompt}`;

    default:
      return `${base}

Provide a comprehensive analysis covering structure, pacing, characters, dialogue, themes, and continuity.${moodColorInstruction}${stylePrompt}`;
  }
}

// ── Main analysis function (streaming) ──

export async function analyzeScreenplay(
  scenes: SceneWithElements[],
  characters: Character[],
  analysisType: string,
  customPrompt?: string,
  onToken?: (text: string) => void,
  productionStyle?: string | null,
): Promise<AnalysisResult> {
  const screenplayText = buildScreenplayText(scenes, characters);
  const systemPrompt = getAnalysisPrompt(analysisType, customPrompt, productionStyle);

  const client = await getAnthropicClient();
  const stream = client.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 16000,
    tool_choice: { type: "tool", name: "script_analysis" },
    tools: [SCRIPT_ANALYSIS_TOOL],
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Analyze this screenplay:\n\n${screenplayText}`,
      },
    ],
  });

  // Pipe each token event to the caller to keep the connection alive
  stream.on("inputJson", (_delta, snapshot) => {
    if (onToken) {
      try { onToken(JSON.stringify(snapshot).slice(0, 20)); } catch { /* ignore */ }
    }
  });

  const finalMessage = await stream.finalMessage();
  const toolUse = finalMessage.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not return a structured script analysis");
  }

  return toolUse.input as AnalysisResult;
}
