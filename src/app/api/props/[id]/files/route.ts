import { NextResponse } from "next/server";
import { getPropFiles } from "@/lib/db/queries";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const numId = Number(id);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid prop ID" }, { status: 400 });
    const files = await getPropFiles(numId);
    return NextResponse.json(files);
  } catch (err) {
    logger.error("GET /api/props/[id]/files error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to fetch prop files" }, { status: 500 });
  }
}
