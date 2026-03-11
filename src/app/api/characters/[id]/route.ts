import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { characters } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { deleteCharacter } from "@/lib/db/queries";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const CHARACTER_UPDATABLE_FIELDS = [
  "name", "description", "voiceId", "voiceName", "role",
  "personalityTraits", "archetype", "emotionalRange", "speakingStyle",
  "backstory", "aiGenerationNotes", "aiScriptNotes",
] as const;

// TECH AUDIT FIX: Added try/catch, safe JSON parsing, and ID validation
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchema();
    const { id } = await params;
    const numId = Number(id);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid character ID" }, { status: 400 });

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    const allowed: Record<string, unknown> = {};
    for (const key of CHARACTER_UPDATABLE_FIELDS) {
      if (key in body) allowed[key] = body[key];
    }
    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }
    await db.update(characters).set(allowed).where(eq(characters.id, numId));
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("PATCH /api/characters/[id] error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to update character" }, { status: 500 });
  }
}

// TECH AUDIT FIX: Added try/catch and ID validation
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchema();
    const { id } = await params;
    const numId = Number(id);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid character ID" }, { status: 400 });
    await deleteCharacter(numId);
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("DELETE /api/characters/[id] error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to delete character" }, { status: 500 });
  }
}
