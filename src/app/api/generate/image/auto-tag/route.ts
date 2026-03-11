import { NextResponse } from "next/server";
import { getImageGeneration, updateImageGeneration } from "@/lib/db/queries";
import { readFile } from "@/lib/storage";
import { autoTagImage } from "@/lib/claude";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // TECH AUDIT FIX: Wrapped req.json() in try/catch for malformed JSON
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
  }
  const generationId = Number(body.generationId);

  if (!generationId || isNaN(generationId)) {
    return NextResponse.json({ error: "generationId required" }, { status: 400 });
  }

  const gen = await getImageGeneration(generationId);
  if (!gen || !gen.storagePath) {
    return NextResponse.json({ error: "Generation not found or no image" }, { status: 404 });
  }

  // Already tagged
  if (gen.tags) {
    try {
      const existing = JSON.parse(gen.tags as string);
      if (Array.isArray(existing) && existing.length > 0) {
        return NextResponse.json({ tags: existing });
      }
    } catch {}
  }

  try {
    const buffer = await readFile(gen.storagePath);
    const base64 = buffer.toString("base64");
    const mimeType = gen.mimeType || "image/png";

    const tags = await autoTagImage(base64, mimeType);

    await updateImageGeneration(gen.id, { tags: JSON.stringify(tags) });

    return NextResponse.json({ tags });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Auto-tagging failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
