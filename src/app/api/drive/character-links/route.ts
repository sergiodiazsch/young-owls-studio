import { NextResponse } from "next/server";
import { createCharacterFileLink, deleteCharacterFileLink } from "@/lib/db/queries";
import { db, ensureSchema } from "@/lib/db";
import { characterFileLinks } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// TECH AUDIT FIX: Added try/catch and safe JSON parsing
export async function POST(req: Request) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    const { characterId, fileId, isPrimary } = body;
    if (!characterId || !fileId) {
      return NextResponse.json({ error: "characterId and fileId are required" }, { status: 400 });
    }

    const link = await createCharacterFileLink(characterId as number, fileId as number, isPrimary as boolean | undefined);
    return NextResponse.json(link, { status: 201 });
  } catch (err) {
    logger.error("POST /api/drive/character-links error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to create character link" }, { status: 500 });
  }
}

// Set primary image for a character
export async function PATCH(req: Request) {
  try {
    await ensureSchema();
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    const { characterId, linkId } = body;
    if (!characterId || !linkId) {
      return NextResponse.json({ error: "characterId and linkId are required" }, { status: 400 });
    }

    // Unset all primary flags for this character
    await db.update(characterFileLinks)
      .set({ isPrimary: false })
      .where(eq(characterFileLinks.characterId, Number(characterId)));

    // Set the selected one as primary
    await db.update(characterFileLinks)
      .set({ isPrimary: true })
      .where(and(
        eq(characterFileLinks.id, Number(linkId)),
        eq(characterFileLinks.characterId, Number(characterId)),
      ));

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("PATCH /api/drive/character-links error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to set primary image" }, { status: 500 });
  }
}

// TECH AUDIT FIX: Added try/catch and safe JSON parsing
export async function DELETE(req: Request) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    const { id } = body;
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    await deleteCharacterFileLink(id as number);
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("DELETE /api/drive/character-links error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to delete character link" }, { status: 500 });
  }
}
