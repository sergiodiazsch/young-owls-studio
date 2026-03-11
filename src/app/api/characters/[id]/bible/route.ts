import { NextResponse } from "next/server";
import { getCharacterDialoguesAcrossProjects, getCharacterGenerationHistory } from "@/lib/db/queries";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const charId = Number(id);
    if (isNaN(charId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    // Get character details from the main API
    const { searchParams } = new URL(_req.url);
    const name = searchParams.get("name");
    if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

    const [dialogues, generationHistory] = await Promise.all([
      getCharacterDialoguesAcrossProjects(name),
      getCharacterGenerationHistory(charId),
    ]);

    // Extract unique seeds
    const seeds = generationHistory
      .filter((g) => g.seed != null)
      .map((g) => ({ seed: g.seed!, prompt: g.generationPrompt, fileId: g.fileId }));

    // Extract unique prompts with counts
    const promptMap = new Map<string, number>();
    for (const g of generationHistory) {
      if (g.generationPrompt) {
        promptMap.set(g.generationPrompt, (promptMap.get(g.generationPrompt) || 0) + 1);
      }
    }
    const topPrompts = Array.from(promptMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([prompt, count]) => ({ prompt, count }));

    return NextResponse.json({
      dialogues,
      generationHistory,
      seeds,
      topPrompts,
    });
  } catch (err) {
    logger.error("GET /api/characters/[id]/bible", err as Record<string, unknown>);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
