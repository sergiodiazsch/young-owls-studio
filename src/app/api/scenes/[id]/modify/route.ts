import { NextResponse } from "next/server";
import { getSceneWithElements } from "@/lib/db/queries";
import { generateSceneModifications } from "@/lib/claude";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // TECH AUDIT FIX: Wrapped req.json() in try/catch and added ID validation
  const numId = Number(id);
  if (isNaN(numId)) return NextResponse.json({ error: "Invalid scene ID" }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
  }
  const { prompt } = body;

  // TECH AUDIT FIX: Added prompt validation
  if (!prompt || typeof prompt !== "string") {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const scene = await getSceneWithElements(numId);
  if (!scene) {
    return NextResponse.json({ error: "Scene not found" }, { status: 404 });
  }

  // Build scene context string
  const elements = [
    ...scene.dialogues.map((d) => ({ ...d, _kind: "dialogue" as const })),
    ...scene.directions.map((d) => ({ ...d, _kind: "direction" as const })),
  ].sort((a, b) => a.sortOrder - b.sortOrder);

  let context = `Scene: ${scene.heading}\n`;
  if (scene.synopsis) context += `Synopsis: ${scene.synopsis}\n`;
  context += "\nScript:\n";

  for (const el of elements) {
    if (el._kind === "dialogue") {
      const d = el as typeof scene.dialogues[0];
      context += `\n${d.character}${d.parenthetical ? ` ${d.parenthetical}` : ""}\n${d.line}\n`;
    } else {
      const d = el as typeof scene.directions[0];
      context += `\n[${d.type.toUpperCase()}] ${d.content}\n`;
    }
  }

  try {
    const options = await generateSceneModifications(context, prompt);
    return NextResponse.json({ options });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to generate modifications";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
