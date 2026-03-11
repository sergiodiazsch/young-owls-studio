import Anthropic from "@anthropic-ai/sdk";
import { getSetting } from "./db/queries";
import type { ParsedScreenplay, SceneModificationOption } from "./types";

async function getAnthropicClient(): Promise<Anthropic> {
  const setting = await getSetting("anthropic_api_key");
  const apiKey = setting?.value || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Anthropic API key not configured. Go to Settings or set ANTHROPIC_API_KEY env var.");
  return new Anthropic({ apiKey });
}

const EXTRACT_TOOL: Anthropic.Tool = {
  name: "extract_screenplay",
  description:
    "Extract structured screenplay data from raw text. Parse every scene, dialogue line, action, transition, and character.",
  input_schema: {
    type: "object" as const,
    required: ["title", "subtitle", "scenes", "characters"],
    properties: {
      title: { type: "string", description: "The screenplay title" },
      subtitle: {
        type: "string",
        description: "Subtitle, episode title, or version info",
      },
      scenes: {
        type: "array",
        description: "All scenes in order",
        items: {
          type: "object",
          required: [
            "sceneNumber",
            "heading",
            "headingType",
            "location",
            "timeOfDay",
            "synopsis",
            "elements",
          ],
          properties: {
            sceneNumber: {
              type: "number",
              description: "Scene number (sequential)",
            },
            heading: {
              type: "string",
              description:
                "Full scene heading line, e.g. 'INT. OFFICE - DAY'",
            },
            headingType: {
              type: "string",
              enum: ["INT", "EXT", "INT/EXT", "EXT/INT"],
              description: "Interior/exterior designation",
            },
            location: {
              type: "string",
              description: "The location name from the heading",
            },
            timeOfDay: {
              type: "string",
              description:
                "Time of day from heading (DAY, NIGHT, MORNING, etc.)",
            },
            section: {
              type: "string",
              description:
                "Act or section label if present (e.g. 'ACT ONE', 'COLD OPEN')",
            },
            synopsis: {
              type: "string",
              description:
                "1-2 sentence summary of what happens in this scene",
            },
            elements: {
              type: "array",
              description:
                "All dialogue and direction elements in script order",
              items: {
                type: "object",
                required: ["type", "sortOrder"],
                properties: {
                  type: {
                    type: "string",
                    enum: [
                      "dialogue",
                      "action",
                      "transition",
                      "broll",
                      "music",
                      "note",
                    ],
                  },
                  character: {
                    type: "string",
                    description: "Character name (for dialogue type)",
                  },
                  parenthetical: {
                    type: "string",
                    description:
                      "Parenthetical direction (for dialogue type), e.g. '(whispering)'",
                  },
                  line: {
                    type: "string",
                    description: "The dialogue line (for dialogue type)",
                  },
                  content: {
                    type: "string",
                    description:
                      "Content text (for action/transition/broll/music/note types)",
                  },
                  sortOrder: {
                    type: "number",
                    description: "Order within the scene (0-indexed)",
                  },
                },
              },
            },
          },
        },
      },
      characters: {
        type: "array",
        description: "All unique characters found in the screenplay",
        items: {
          type: "object",
          required: ["name", "description"],
          properties: {
            name: {
              type: "string",
              description: "Character name in UPPERCASE as used in script",
            },
            description: {
              type: "string",
              description:
                "Brief character description based on their dialogue and actions",
            },
          },
        },
      },
    },
  },
};

export async function parseScreenplay(
  rawText: string
): Promise<ParsedScreenplay> {
  const client = await getAnthropicClient();
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 16000,
    tool_choice: { type: "tool", name: "extract_screenplay" },
    tools: [EXTRACT_TOOL],
    messages: [
      {
        role: "user",
        content: `Parse this screenplay into structured data. Extract EVERY scene, dialogue line, action description, transition, and character. Preserve the exact order of elements within each scene. For B-Roll references, music cues, and editorial notes, use the appropriate types (broll, music, note).

SCREENPLAY TEXT:
${rawText}`,
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not return structured tool output");
  }

  return toolUse.input as ParsedScreenplay;
}

// ── Scene Modification Tool ──

const SCENE_MODIFICATIONS_TOOL: Anthropic.Tool = {
  name: "scene_modifications",
  description: "Generate 3 alternative versions of a screenplay scene based on a modification prompt.",
  input_schema: {
    type: "object" as const,
    required: ["options"],
    properties: {
      options: {
        type: "array",
        description: "Exactly 3 modification options: conservative, moderate, and bold",
        items: {
          type: "object",
          required: ["label", "synopsis", "elements"],
          properties: {
            label: { type: "string", description: "Short label for this option (e.g. 'Conservative Rewrite')" },
            synopsis: { type: "string", description: "1-2 sentence summary of changes made" },
            elements: {
              type: "array",
              description: "All dialogue and direction elements in script order",
              items: {
                type: "object",
                required: ["type", "sortOrder"],
                properties: {
                  type: { type: "string", enum: ["dialogue", "action", "transition", "broll", "music", "note"] },
                  character: { type: "string" },
                  parenthetical: { type: "string" },
                  line: { type: "string" },
                  content: { type: "string" },
                  sortOrder: { type: "number" },
                },
              },
            },
          },
        },
      },
    },
  },
};

export async function generateSceneModifications(
  sceneContext: string,
  modificationPrompt: string
): Promise<SceneModificationOption[]> {
  const client = await getAnthropicClient();
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 16000,
    tool_choice: { type: "tool", name: "scene_modifications" },
    tools: [SCENE_MODIFICATIONS_TOOL],
    messages: [
      {
        role: "user",
        content: `You are a screenwriting assistant. Given the current scene and a modification request, generate exactly 3 alternative versions:

1. **Conservative** — Minimal changes, stays close to original intent
2. **Moderate** — Meaningful changes while keeping the core structure
3. **Bold** — Significant creative reimagining

CURRENT SCENE:
${sceneContext}

MODIFICATION REQUEST:
${modificationPrompt}

Generate all 3 options with complete dialogue and direction elements. Preserve element types (dialogue, action, transition, etc.) and proper screenplay formatting.`,
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not return scene modifications");
  }

  const result = toolUse.input as { options: SceneModificationOption[] };
  return result.options;
}

// ── Image Auto-Tagging (Vision) ──

export async function autoTagImage(imageBase64: string, mimeType: string): Promise<string[]> {
  const client = await getAnthropicClient();
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mimeType as "image/png" | "image/jpeg" | "image/gif" | "image/webp", data: imageBase64 },
          },
          {
            type: "text",
            text: "Analyze this image and return 5-10 short descriptive tags. Focus on: mood/atmosphere, lighting, shot type, time of day, location type, number of people, color palette, genre/style. Return ONLY a JSON array of lowercase strings, nothing else. Example: [\"night\",\"interior\",\"close-up\",\"moody\",\"two characters\",\"warm tones\"]",
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") return [];

  try {
    const parsed = JSON.parse(textBlock.text);
    if (Array.isArray(parsed)) return parsed.map((t: string) => String(t).toLowerCase().trim()).filter(Boolean);
  } catch {
    // Try to extract array from response
    const match = textBlock.text.match(/\[[\s\S]*?\]/);
    if (match) {
      try { return JSON.parse(match[0]); } catch (e) {
        console.warn("autoTagImage: Failed to parse extracted JSON:", e);
      }
    }
  }
  return [];
}

// ── Prompt Suggestion ──

export async function suggestImagePrompt(context: string): Promise<string> {
  const client = await getAnthropicClient();
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: `Based on the following screenplay context, suggest a detailed image generation prompt that would create a compelling visual for this scene or character. Focus on cinematographic details, lighting, mood, and composition.

CONTEXT:
${context}

Respond with ONLY the image prompt, no explanation.`,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock && textBlock.type === "text" ? textBlock.text : "";
}
