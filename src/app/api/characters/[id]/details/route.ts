import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dialogues, scenes } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * GET /api/characters/:id/details?name=CHARACTER_NAME&projectId=123
 * Returns scene count and sample dialogue lines for a character.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const numId = Number(id);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid character ID" }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const characterName = searchParams.get("name");
    const projectId = searchParams.get("projectId");

    if (!characterName || !projectId) {
      return NextResponse.json({ error: "name and projectId are required" }, { status: 400 });
    }

    const pid = Number(projectId);
    if (isNaN(pid)) return NextResponse.json({ error: "projectId must be a number" }, { status: 400 });

    // Get scene count — count distinct scenes this character speaks in
    const sceneCountResult = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${dialogues.sceneId})` })
      .from(dialogues)
      .innerJoin(scenes, eq(dialogues.sceneId, scenes.id))
      .where(sql`UPPER(${dialogues.character}) = UPPER(${characterName}) AND ${scenes.projectId} = ${pid}`);

    const sceneCount = sceneCountResult[0]?.count ?? 0;

    // Get first 5 dialogue lines as excerpts
    const excerpts = await db
      .select({
        line: dialogues.line,
        parenthetical: dialogues.parenthetical,
        sceneHeading: scenes.heading,
      })
      .from(dialogues)
      .innerJoin(scenes, eq(dialogues.sceneId, scenes.id))
      .where(sql`UPPER(${dialogues.character}) = UPPER(${characterName}) AND ${scenes.projectId} = ${pid}`)
      .orderBy(dialogues.sortOrder)
      .limit(5);

    return NextResponse.json({ sceneCount, excerpts });
  } catch (err) {
    logger.error("GET /api/characters/[id]/details error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to fetch character details" }, { status: 500 });
  }
}
