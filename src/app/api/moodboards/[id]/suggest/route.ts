import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { moodboards, moodboardItems } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { getSetting } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureSchema();
  const { id } = await params;
  const body = await req.json();
  const context = body.context ?? "";

  // Load moodboard and its items
  const [board] = await db
    .select()
    .from(moodboards)
    .where(eq(moodboards.id, Number(id)));

  if (!board) {
    return NextResponse.json({ error: "Moodboard not found" }, { status: 404 });
  }

  const items = await db
    .select()
    .from(moodboardItems)
    .where(eq(moodboardItems.moodboardId, Number(id)))
    .orderBy(asc(moodboardItems.sortOrder));

  // Build description of current board contents
  const imageCount = items.filter((i) => i.type === "image").length;
  const textItems = items.filter((i) => i.type === "text");
  const colorItems = items.filter((i) => i.type === "color");

  const boardDescription = [
    `Title: "${board.title}"`,
    board.description ? `Description: ${board.description}` : null,
    `Layout: ${board.layout}`,
    `${imageCount} image(s)`,
    textItems.length > 0
      ? `Text notes: ${textItems.map((t) => `"${t.textContent}"`).join(", ")}`
      : null,
    colorItems.length > 0
      ? `Colors: ${colorItems.map((c) => `${c.colorName || "unnamed"} (${c.colorValue})`).join(", ")}`
      : null,
    items
      .filter((i) => i.caption)
      .map((i) => `Caption: "${i.caption}"`)
      .join("; ") || null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const setting = await getSetting("anthropic_api_key");
    const apiKey = setting?.value || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Anthropic API key not configured" }, { status: 500 });
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: `You are a visual development and mood board consultant for film/TV production. Analyze this mood board and suggest improvements.

CURRENT MOODBOARD:
${boardDescription}

${context ? `ADDITIONAL CONTEXT:\n${context}\n` : ""}

Respond with ONLY a JSON object (no markdown, no code fences) with these fields:
{
  "analysis": "Brief analysis of the current board's visual direction and mood (2-3 sentences)",
  "suggestions": ["array of 4-6 specific image generation prompts that would complement this board"],
  "colorPalette": ["array of 4-6 hex color values that would work well with this board's aesthetic"],
  "missingElements": ["array of 2-4 types of visual elements the board is missing, e.g. 'wide establishing shot', 'close-up detail texture', 'color contrast element'"]
}`,
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { error: "No response from AI" },
        { status: 500 }
      );
    }

    // Parse JSON from response, handling potential markdown wrapping
    let parsed;
    try {
      parsed = JSON.parse(textBlock.text);
    } catch {
      const match = textBlock.text.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        return NextResponse.json(
          { error: "Failed to parse AI response" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI suggestion failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
