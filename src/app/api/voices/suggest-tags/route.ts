import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSetting } from "@/lib/db/queries";
import { safeJson } from "@/lib/api-utils";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const AVAILABLE_TAGS = [
  "happy", "sad", "angry", "excited", "curious", "surprised", "annoyed",
  "appalled", "thoughtful", "sympathetic", "reassuring", "warmly", "sheepishly",
  "whispers", "shouting", "sarcastic", "dramatically", "mischievously",
  "professional", "questioning", "muttering", "impressively",
  "laughs", "chuckles", "sighs", "gasps", "crying", "snorts",
  "clears throat", "exhales", "inhales deeply", "swallows", "stifling laughter",
  "pause", "short pause", "long pause", "slowly", "quickly",
  "sings", "classic film noir", "fantasy narrator", "sci-fi AI voice",
];

interface SuggestTagsBody {
  dialogueLine: string;
  character: string;
  parenthetical?: string;
  sceneContext?: string;
}

export async function POST(req: Request) {
  try {
    const [body, err] = await safeJson<SuggestTagsBody>(req);
    if (err) return err;

    const { dialogueLine, character, parenthetical, sceneContext } = body;
    if (!dialogueLine || !character) {
      return NextResponse.json({ error: "dialogueLine and character required" }, { status: 400 });
    }

    const setting = await getSetting("anthropic_api_key");
    const apiKey = setting?.value || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Anthropic API key not configured" }, { status: 500 });
    }

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: `You are an audio director for a film production. Analyze this dialogue line and suggest the best ElevenLabs v3 voice tags to apply for realistic delivery.

CHARACTER: ${character}
${parenthetical ? `PARENTHETICAL: (${parenthetical})` : ""}
DIALOGUE: "${dialogueLine}"
${sceneContext ? `\nSCENE CONTEXT: ${sceneContext}` : ""}

Available tags: ${AVAILABLE_TAGS.join(", ")}

Return a JSON object with:
- "tags": array of 1-3 tag strings from the available list (most important first)
- "taggedText": the dialogue line with tags inserted at appropriate positions for natural delivery
- "reasoning": one sentence explaining why these tags fit

Example response:
{"tags":["angry","slowly"],"taggedText":"[angry] [slowly] I told you not to come here.","reasoning":"The character is confronting someone with controlled anger, speaking slowly for emphasis."}

Return ONLY the JSON object.`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ tags: [], taggedText: dialogueLine, reasoning: "" });
    }

    try {
      const match = textBlock.text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        return NextResponse.json({
          tags: Array.isArray(parsed.tags) ? parsed.tags : [],
          taggedText: parsed.taggedText || dialogueLine,
          reasoning: parsed.reasoning || "",
        });
      }
    } catch {
      logger.error("Failed to parse AI tag suggestion", { raw: textBlock.text });
    }

    return NextResponse.json({ tags: [], taggedText: dialogueLine, reasoning: "" });
  } catch (error: unknown) {
    logger.error("POST /api/voices/suggest-tags error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Failed to suggest tags" }, { status: 500 });
  }
}
