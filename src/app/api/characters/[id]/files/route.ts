import { NextResponse } from "next/server";
import { getCharacterFiles } from "@/lib/db/queries";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// TECH AUDIT FIX: Added try/catch and ID validation
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const numId = Number(id);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid character ID" }, { status: 400 });
    const files = await getCharacterFiles(numId);
    return NextResponse.json(files);
  } catch (err) {
    logger.error("GET /api/characters/[id]/files error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to fetch character files" }, { status: 500 });
  }
}
